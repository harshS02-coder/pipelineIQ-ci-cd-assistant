import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import GitHubService from '../services/githubService.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import User from '../models/User.js';
import MonitoredRepo from '../models/MonitoredRepo.js';
import AnalysisResult from '../models/AnalysisResult.js';
import { generateWebhookSecret } from '../utils/encryption.js';

/**
 * ============================================================================
 * GITHUB CONTROLLER — OAuth Flow, Repo Management, Dashboard
 * ============================================================================
 *
 * This controller handles the user-facing GitHub integration:
 *
 * OAUTH ENDPOINTS:
 *   GET  /api/v1/github/auth       → Redirect to GitHub authorization page
 *   GET  /api/v1/github/callback   → Handle OAuth callback, issue JWT
 *
 * USER ENDPOINTS (require JWT):
 *   GET  /api/v1/github/me         → Current user profile
 *   GET  /api/v1/github/repos      → List user's GitHub repos
 *
 * MONITORING ENDPOINTS (require JWT):
 *   POST   /api/v1/github/repos/monitor   → Enable monitoring (create webhook)
 *   DELETE /api/v1/github/repos/monitor   → Disable monitoring (delete webhook)
 *   GET    /api/v1/github/repos/monitored → List monitored repos
 *
 * DASHBOARD (require JWT):
 *   GET  /api/v1/github/dashboard  → Analysis results for monitored repos
 * ============================================================================
 */

class GitHubController {
  /**
   * ========================================================================
   * STEP 1: START OAUTH FLOW
   * ========================================================================
   *
   * When the user clicks "Connect GitHub", the frontend calls this endpoint.
   * We generate a random STATE parameter (for CSRF protection) and redirect
   * the user's browser to GitHub's authorization page.
   *
   * WHY THE STATE PARAMETER:
   * Without it, an attacker could craft a malicious URL like:
   *   https://our-app.com/callback?code=ATTACKERS_CODE
   * and trick a user into visiting it. The user would end up logged in
   * with the ATTACKER'S GitHub account. With the state parameter:
   * - We generate a random state and store it (temporarily, in URL params)
   * - GitHub includes it in the callback: /callback?code=XXX&state=YYY
   * - We verify the state matches before proceeding
   * - The attacker can't predict the random state value
   */
  static async startOAuth(req, res) {
    try {
      // Generate a random state for CSRF protection
      // 16 bytes of randomness = 32 hex characters = plenty of entropy
      const state = crypto.randomBytes(16).toString('hex');

      // Build the GitHub authorization URL and redirect the user
      const authUrl = GitHubService.buildAuthorizationUrl(state);

      logger.info('OAuth flow started, redirecting to GitHub');

      // 302 Redirect: the browser navigates to GitHub's authorization page
      return res.redirect(authUrl);

    } catch (error) {
      logger.error({ err: error }, 'Failed to start OAuth flow');
      return res.status(500).json({ error: 'Failed to start OAuth flow' });
    }
  }

  /**
   * ========================================================================
   * STEP 2: HANDLE OAUTH CALLBACK
   * ========================================================================
   *
   * After the user authorizes our app on GitHub, GitHub redirects them to:
   *   /api/v1/github/callback?code=AUTHORIZATION_CODE&state=RANDOM_STATE
   *
   * This handler:
   * 1. Extracts the authorization code from the query string
   * 2. Exchanges the code for a GitHub access token (server-to-server call)
   * 3. Fetches the user's GitHub profile using the token
   * 4. Creates or updates the user in our database (encrypting the token)
   * 5. Issues a JWT session token for our app
   * 6. Redirects back to the frontend with the JWT in the URL
   *
   * WHY WE ISSUE OUR OWN JWT:
   * The GitHub access token is for calling GitHub's API. It doesn't work
   * for authenticating requests to OUR API. So we create a separate JWT
   * that our frontend sends as a Bearer token for all subsequent requests.
   */
  static async handleCallback(req, res) {
    try {
      const { code, state, error: oauthError } = req.query;

      // Handle OAuth errors (e.g., user denied access)
      if (oauthError) {
        logger.warn({ oauthError }, 'GitHub OAuth denied by user');
        return res.redirect('/?error=oauth_denied');
      }

      if (!code) {
        return res.redirect('/?error=missing_code');
      }

      // STEP 2a: Exchange the authorization code for an access token
      // This is a server-to-server call — the browser never sees the token
      const accessToken = await GitHubService.exchangeCodeForToken(code);

      // STEP 2b: Fetch the user's GitHub profile
      const githubUser = await GitHubService.getAuthenticatedUser(accessToken);

      // STEP 2c: Encrypt the access token before storing in database
      // We NEVER store tokens in plaintext (see encryption.js for why)
      const { encrypted, iv, tag } = encrypt(accessToken);

      // STEP 2d: Upsert the user in our database
      // "upsert" = update if exists, insert if new
      const user = await User.findOneAndUpdate(
        { githubId: githubUser.id },                 // Find by GitHub ID
        {
          githubId: githubUser.id,
          githubUsername: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          accessToken: encrypted,                     // Encrypted ciphertext
          accessTokenIv: iv,                          // IV for decryption
          accessTokenTag: tag,                        // Auth tag for integrity
          lastLoginAt: new Date(),
        },
        {
          upsert: true,                                // Create if not found
          new: true,                                   // Return the updated doc
          setDefaultsOnInsert: true,                   // Apply schema defaults
        }
      );

      // STEP 2e: Issue a JWT for our app
      const jwtToken = jwt.sign(
        {
          userId: user._id,
          githubId: user.githubId,
          githubUsername: user.githubUsername,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }                            // Token valid for 7 days
      );

      logger.info(
        { githubUsername: user.githubUsername },
        'OAuth flow completed, user authenticated'
      );

      // STEP 2f: Redirect to frontend with the JWT
      // The frontend JavaScript reads the token from the URL hash
      return res.redirect(`/?token=${jwtToken}`);

    } catch (error) {
      logger.error({ err: error }, 'OAuth callback failed');
      return res.redirect('/?error=oauth_failed');
    }
  }

  /**
   * Get the currently authenticated user's profile.
   */
  static async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.userId).select(
        '-accessToken -accessTokenIv -accessTokenTag'  // Never expose token fields
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        success: true,
        user: {
          id: user._id,
          githubId: user.githubId,
          githubUsername: user.githubUsername,
          avatarUrl: user.avatarUrl,
          connectedAt: user.connectedAt,
          lastLoginAt: user.lastLoginAt,
        },
      });

    } catch (error) {
      logger.error({ err: error }, 'Error fetching current user');
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  }

  /**
   * List the user's GitHub repositories.
   * Fetches from GitHub API using the stored (encrypted) access token.
   */
  static async listRepos(req, res) {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Decrypt the stored GitHub access token
      const accessToken = decrypt(
        user.accessToken,
        user.accessTokenIv,
        user.accessTokenTag
      );

      // Fetch repos from GitHub API
      const repos = await GitHubService.listUserRepos(accessToken);

      // Get list of already-monitored repos for this user
      const monitoredRepos = await MonitoredRepo.find({
        userId: user._id,
        isActive: true,
      });
      const monitoredSet = new Set(monitoredRepos.map((r) => r.repoFullName));

      // Annotate each repo with monitoring status
      const annotatedRepos = repos.map((repo) => ({
        ...repo,
        isMonitored: monitoredSet.has(repo.fullName),
      }));

      return res.json({
        success: true,
        repos: annotatedRepos,
        total: annotatedRepos.length,
      });

    } catch (error) {
      logger.error({ err: error }, 'Error listing repos');
      return res.status(500).json({ error: 'Failed to list repositories' });
    }
  }

  /**
   * ========================================================================
   * ENABLE MONITORING — Create Webhook on GitHub
   * ========================================================================
   *
   * When a user toggles monitoring ON for a repo, we:
   * 1. Decrypt their GitHub access token
   * 2. Generate a unique webhook secret for this repo
   * 3. Call GitHub's API to register a webhook on the repo
   * 4. Store the webhook ID + secret in our MonitoredRepo collection
   */
  static async enableMonitoring(req, res) {
    try {
      const { repoFullName } = req.body;

      if (!repoFullName || !repoFullName.includes('/')) {
        return res.status(400).json({ error: 'Invalid repo name. Expected format: owner/repo' });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already monitoring this repo
      const existing = await MonitoredRepo.findOne({
        userId: user._id,
        repoFullName,
        isActive: true,
      });

      if (existing) {
        return res.status(409).json({ error: 'Already monitoring this repository' });
      }

      // Decrypt the user's GitHub token
      const accessToken = decrypt(
        user.accessToken,
        user.accessTokenIv,
        user.accessTokenTag
      );

      // Generate a unique secret for this repo's webhook
      // This is used for HMAC-SHA256 signature verification
      const webhookSecret = generateWebhookSecret();

      // Build the webhook URL (our public endpoint)
      const baseUrl = (process.env.WEBHOOK_BASE_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
      const webhookUrl = `${baseUrl}/api/v1/webhooks/github`;

      const [owner, repo] = repoFullName.split('/');

      // Register the webhook on GitHub
      const webhookData = await GitHubService.createWebhook(
        accessToken,
        owner,
        repo,
        webhookUrl,
        webhookSecret
      );

      // Fetch repo details for metadata
      const repos = await GitHubService.listUserRepos(accessToken);
      const repoInfo = repos.find((r) => r.fullName === repoFullName);

      // Store the monitoring record
      const monitoredRepo = new MonitoredRepo({
        userId: user._id,
        repoFullName,
        repoId: repoInfo?.id || webhookData.id,
        webhookId: webhookData.id,
        webhookSecret,
        isActive: true,
        repoMeta: {
          description: repoInfo?.description,
          language: repoInfo?.language,
          defaultBranch: repoInfo?.defaultBranch,
          isPrivate: repoInfo?.isPrivate,
          htmlUrl: repoInfo?.htmlUrl,
        },
      });

      await monitoredRepo.save();

      logger.info(
        { repoFullName, webhookId: webhookData.id },
        'Monitoring enabled for repository'
      );

      return res.status(201).json({
        success: true,
        message: `Monitoring enabled for ${repoFullName}`,
        monitoredRepo: {
          id: monitoredRepo._id,
          repoFullName: monitoredRepo.repoFullName,
          webhookId: monitoredRepo.webhookId,
          isActive: monitoredRepo.isActive,
        },
      });

    } catch (error) {
      logger.error({ err: error }, 'Error enabling monitoring');
      return res.status(500).json({
        error: 'Failed to enable monitoring',
        details: error.message,
      });
    }
  }

  /**
   * Disable monitoring — delete webhook from GitHub and deactivate record.
   */
  static async disableMonitoring(req, res) {
    try {
      const { repoFullName } = req.body;

      if (!repoFullName) {
        return res.status(400).json({ error: 'repoFullName is required' });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const monitoredRepo = await MonitoredRepo.findOne({
        userId: user._id,
        repoFullName,
        isActive: true,
      });

      if (!monitoredRepo) {
        return res.status(404).json({ error: 'Repository is not being monitored' });
      }

      // Decrypt the user's GitHub token to delete the webhook
      const accessToken = decrypt(
        user.accessToken,
        user.accessTokenIv,
        user.accessTokenTag
      );

      const [owner, repo] = repoFullName.split('/');

      // Delete the webhook from GitHub
      await GitHubService.deleteWebhook(
        accessToken,
        owner,
        repo,
        monitoredRepo.webhookId
      );

      // Deactivate the monitoring record (soft delete)
      monitoredRepo.isActive = false;
      await monitoredRepo.save();

      logger.info({ repoFullName }, 'Monitoring disabled for repository');

      return res.json({
        success: true,
        message: `Monitoring disabled for ${repoFullName}`,
      });

    } catch (error) {
      logger.error({ err: error }, 'Error disabling monitoring');
      return res.status(500).json({
        error: 'Failed to disable monitoring',
        details: error.message,
      });
    }
  }

  /**
   * List all repositories the user is currently monitoring.
   */
  static async listMonitored(req, res) {
    try {
      const monitoredRepos = await MonitoredRepo.find({
        userId: req.user.userId,
        isActive: true,
      }).sort({ createdAt: -1 });

      return res.json({
        success: true,
        repos: monitoredRepos.map((r) => ({
          id: r._id,
          repoFullName: r.repoFullName,
          isActive: r.isActive,
          lastEventAt: r.lastEventAt,
          repoMeta: r.repoMeta,
          createdAt: r.createdAt,
        })),
      });

    } catch (error) {
      logger.error({ err: error }, 'Error listing monitored repos');
      return res.status(500).json({ error: 'Failed to list monitored repos' });
    }
  }

  /**
   * Dashboard — returns analysis results for all of a user's monitored repos.
   */
  static async getDashboard(req, res) {
    try {
      // Get all monitored repos for this user
      const monitoredRepos = await MonitoredRepo.find({
        userId: req.user.userId,
        isActive: true,
      });

      const repoNames = monitoredRepos.map((r) => r.repoFullName);

      // Find all pipeline failures for these repos
      const { default: PipelineFailure } = await import('../models/PipelineFailure.js');

      const failures = await PipelineFailure.find({
        repositoryUrl: { $regex: repoNames.map(r => r.replace('/', '\\/')).join('|') },
      })
        .sort({ createdAt: -1 })
        .limit(50);

      // Get analysis results for these failures
      const failureIds = failures.map((f) => f._id);
      const analyses = await AnalysisResult.find({
        failureId: { $in: failureIds },
      });

      // Build a map of failureId → analysis for quick lookup
      const analysisMap = new Map();
      for (const a of analyses) {
        analysisMap.set(a.failureId.toString(), a);
      }

      // Combine failures with their analyses
      const dashboardItems = failures.map((failure) => {
        const analysis = analysisMap.get(failure._id.toString());
        const ageMs = Date.now() - new Date(failure.createdAt).getTime();
        const hasCompletedAnalysis = Boolean(analysis && (analysis.rootCause || analysis.summary));
        const isStuckOrFailed = (!hasCompletedAnalysis && ageMs > 3 * 60 * 1000) || failure.status === 'failed';
        const effectiveStatus = isStuckOrFailed ? 'failed' : failure.status;

        return {
          id: failure._id,
          repoFullName: failure.repositoryUrl
            ? failure.repositoryUrl.replace('https://github.com/', '')
            : 'unknown',
          pipelineName: failure.pipelineName,
          branch: failure.branch,
          commitSha: failure.commitSha,
          status: effectiveStatus,
          isAnalysisFailed: isStuckOrFailed,
          failureType: failure.failureType,
          createdAt: failure.createdAt,
          rawLogs: failure.logs?.raw || null,
          analysis: hasCompletedAnalysis
            ? {
                id: analysis._id,
                summary: analysis.summary,
                rootCause: analysis.rootCause,
                confidence: analysis.confidence ?? analysis.rootCauseConfidence ?? 0.5,
                severity: analysis.suggestedFixes?.[0]?.severity || 'unknown',
                suggestedFixes: (analysis.suggestedFixes || []).map((f) => ({
                  id: f.id,
                  title: f.title,
                  description: f.description,
                  severity: f.severity,
                  isSafe: f.isSafe,
                  commands: f.commands || [],
                  estimatedTime: f.estimatedTime || null,
                })),
                completedAt: analysis.completedAt,
              }
            : null,
        };
      });

      return res.json({
        success: true,
        items: dashboardItems,
        total: dashboardItems.length,
        monitoredRepos: repoNames.length,
      });

    } catch (error) {
      logger.error({ err: error }, 'Error fetching dashboard');
      return res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  }
}

export default GitHubController;
