import axios from 'axios';
import AdmZip from 'adm-zip';
import logger from '../config/logger.js';

/**
 * ============================================================================
 * GITHUB SERVICE — All GitHub API Interactions
 * ============================================================================
 *
 * This service encapsulates every GitHub REST API call we make:
 * - OAuth token exchange
 * - User profile fetching
 * - Repository listing
 * - Webhook creation/deletion
 * - Workflow log fetching & unzipping
 *
 * GITHUB REST API AUTHENTICATION:
 * GitHub's API supports several auth methods. We use two:
 *
 * 1. OAuth App credentials (client_id + client_secret):
 *    Used only during the token exchange step (code → access_token).
 *    This proves to GitHub that OUR APP is requesting the token.
 *
 * 2. User access tokens (Authorization: Bearer gho_...):
 *    Used for all subsequent API calls on behalf of the user.
 *    This token was obtained via OAuth and proves the USER authorized us.
 *
 * API BASE URL: https://api.github.com
 * All endpoints return JSON. Rate limits: 5000 requests/hour per user token.
 * ============================================================================
 */

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OAUTH_BASE = 'https://github.com';

class GitHubService {
  /**
   * ========================================================================
   * OAUTH TOKEN EXCHANGE
   * ========================================================================
   *
   * This is Step 3 of the OAuth Authorization Code flow:
   *
   * THE FULL OAUTH FLOW:
   * ┌──────────┐        ┌──────────┐        ┌──────────┐
   * │  Browser  │        │ Our App  │        │  GitHub  │
   * └────┬─────┘        └────┬─────┘        └────┬─────┘
   *      │ 1. Click "Connect"│                    │
   *      │──────────────────>│                    │
   *      │                   │                    │
   *      │ 2. Redirect to GitHub                  │
   *      │<──────────────────│                    │
   *      │    /login/oauth/authorize?             │
   *      │    client_id=XXX&scope=repo            │
   *      │                   │                    │
   *      │ 3. User sees GitHub consent screen     │
   *      │───────────────────────────────────────>│
   *      │    "Allow [App] to access your repos?" │
   *      │                   │                    │
   *      │ 4. User clicks "Authorize"             │
   *      │<───────────────────────────────────────│
   *      │    Redirect to our callback:           │
   *      │    /callback?code=AUTHORIZATION_CODE   │
   *      │                   │                    │
   *      │ 5. Browser hits our callback           │
   *      │──────────────────>│                    │
   *      │                   │                    │
   *      │                   │ 6. Exchange code   │
   *      │                   │   for token        │
   *      │                   │───────────────────>│
   *      │                   │  POST /oauth/token │
   *      │                   │  {client_id,       │
   *      │                   │   client_secret,   │
   *      │                   │   code}            │
   *      │                   │                    │
   *      │                   │ 7. Receive token   │
   *      │                   │<───────────────────│
   *      │                   │  {access_token:    │
   *      │                   │   "gho_xxxx"}      │
   *      │                   │                    │
   *      │ 8. Return JWT     │                    │
   *      │<──────────────────│                    │
   *      │                   │                    │
   *
   * WHY "AUTHORIZATION CODE" (and not just send the token directly)?
   * This is a security measure. If GitHub redirected with the access token
   * in the URL, anyone who can see the URL (browser history, server logs,
   * a man-in-the-middle) gets the token. Instead:
   * - GitHub sends a short-lived AUTHORIZATION CODE in the redirect URL
   * - Our server exchanges this code for the actual token via a secure
   *   server-to-server POST request (never visible to the browser)
   * - The code is one-time use and expires in 10 minutes
   *
   * @param {string} code - The authorization code from GitHub's redirect
   * @returns {Promise<string>} The access token (e.g., "gho_xxxx...")
   */
  static async exchangeCodeForToken(code) {
    try {
      // POST to GitHub's OAuth token endpoint
      // We send our client_id + client_secret to prove we are the app
      // that owns this OAuth registration, plus the code from the redirect
      const response = await axios.post(
        `${GITHUB_OAUTH_BASE}/login/oauth/access_token`,
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        },
        {
          headers: {
            // Request JSON response (GitHub defaults to URL-encoded otherwise)
            Accept: 'application/json',
          },
          timeout: 10000,
        }
      );

      const { access_token, error, error_description } = response.data;

      if (error) {
        throw new Error(`GitHub OAuth error: ${error} — ${error_description}`);
      }

      if (!access_token) {
        throw new Error('No access token received from GitHub');
      }

      logger.info('GitHub OAuth token exchange successful');
      return access_token;

    } catch (error) {
      logger.error({ err: error }, 'GitHub OAuth token exchange failed');
      throw error;
    }
  }

  /**
   * Fetch the authenticated user's GitHub profile.
   * Called after token exchange to get their GitHub ID, username, and avatar.
   *
   * @param {string} token - GitHub access token
   * @returns {Promise<object>} { id, login, avatar_url, ... }
   */
  static async getAuthenticatedUser(token) {
    const response = await axios.get(`${GITHUB_API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
      timeout: 10000,
    });

    return response.data;
  }

  /**
   * List repositories the authenticated user has access to.
   * Returns repos sorted by most recently pushed.
   *
   * GitHub paginates results (max 100 per page). We fetch up to 3 pages
   * (300 repos) to keep the response size manageable.
   *
   * @param {string} token - GitHub access token
   * @returns {Promise<Array>} Array of repo objects
   */
  static async listUserRepos(token) {
    const repos = [];
    let page = 1;
    const maxPages = 3; // Fetch up to 300 repos

    while (page <= maxPages) {
      const response = await axios.get(`${GITHUB_API_BASE}/user/repos`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
        params: {
          sort: 'pushed',       // Most recently active repos first
          direction: 'desc',
          per_page: 100,        // Max allowed by GitHub
          page,
          type: 'all',          // Include owned + collaborator repos
        },
        timeout: 15000,
      });

      repos.push(...response.data);

      // If we got fewer than 100, there are no more pages
      if (response.data.length < 100) break;
      page++;
    }

    // Return a simplified version of each repo (GitHub returns ~100 fields per repo)
    return repos.map((repo) => ({
      id: repo.id,
      fullName: repo.full_name,         // "owner/repo"
      name: repo.name,                   // "repo"
      owner: repo.owner.login,           // "owner"
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.default_branch,
      isPrivate: repo.private,
      htmlUrl: repo.html_url,
      pushedAt: repo.pushed_at,
      hasActions: true, // Can't easily check without another API call
    }));
  }

  /**
   * ========================================================================
   * WEBHOOK REGISTRATION
   * ========================================================================
   *
   * Registers a webhook on a GitHub repository using the REST API.
   *
   * HOW GITHUB WEBHOOKS WORK:
   * A webhook is a "callback URL" that GitHub calls whenever certain events
   * happen in a repo. It's like subscribing to notifications:
   *
   * 1. We tell GitHub: "Hey, call POST https://our-server.com/webhook/github
   *    whenever a workflow_run event happens in this repo."
   *
   * 2. GitHub stores this configuration and, from now on, sends an HTTP POST
   *    request to our URL every time a GitHub Actions run starts/completes.
   *
   * 3. The POST body contains a JSON payload describing the event (which
   *    workflow, which commit, whether it succeeded or failed, etc.)
   *
   * WEBHOOK SECURITY:
   * We provide a "secret" when creating the webhook. GitHub uses this secret
   * to compute an HMAC-SHA256 signature over the payload body and sends it
   * in the X-Hub-Signature-256 header. When we receive the webhook, we
   * recompute the HMAC using our stored secret and compare. This proves:
   *   a) The request genuinely came from GitHub (not a spoofed request)
   *   b) The payload wasn't modified in transit
   *
   * @param {string} token - GitHub access token (needs "admin:repo_hook" scope)
   * @param {string} owner - Repository owner (e.g., "octocat")
   * @param {string} repo - Repository name (e.g., "hello-world")
   * @param {string} webhookUrl - Our public URL (e.g., "https://ngrok-url/webhook/github")
   * @param {string} secret - Random secret for HMAC signature verification
   * @returns {Promise<object>} GitHub's webhook response (includes the webhook ID)
   */
  static async createWebhook(token, owner, repo, webhookUrl, secret) {
    try {
      const response = await axios.post(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks`,
        {
          // Webhook configuration
          name: 'web',  // "web" = HTTP webhook (the only type supported via API)
          config: {
            url: webhookUrl,          // Where GitHub sends the POST request
            content_type: 'json',     // Send JSON (not form-encoded)
            secret,                   // For HMAC-SHA256 signature verification
            insecure_ssl: '0',        // Require valid SSL (set '1' only for testing)
          },
          // Which events to subscribe to
          // "workflow_run" fires when a GitHub Actions workflow starts, completes, or fails
          events: ['workflow_run'],
          active: true,              // Enable the webhook immediately
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
          timeout: 10000,
        }
      );

      logger.info(
        { webhookId: response.data.id, repo: `${owner}/${repo}` },
        'Webhook registered on GitHub'
      );

      return response.data;

    } catch (error) {
      // GitHub returns 422 if a webhook with this URL already exists
      if (error.response?.status === 422) {
        logger.warn(
          { repo: `${owner}/${repo}` },
          'Webhook already exists for this URL, attempting to find and reuse it'
        );

        // Try to find the existing webhook
        const hooks = await this.listWebhooks(token, owner, repo);
        const existing = hooks.find((h) => h.config?.url === webhookUrl);
        if (existing) {
          return this.updateWebhook(
            token,
            owner,
            repo,
            existing.id,
            webhookUrl,
            secret
          );
        }
      }

      logger.error({ err: error, repo: `${owner}/${repo}` }, 'Webhook registration failed');
      throw error;
    }
  }

  /**
   * List all webhooks on a repository.
   */
  static async listWebhooks(token, owner, repo) {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
        timeout: 10000,
      }
    );

    return response.data;
  }

  /**
   * Update an existing webhook's delivery format and secret.
   * This repairs hooks created with GitHub's default form-encoded format.
   */
  static async updateWebhook(token, owner, repo, webhookId, webhookUrl, secret) {
    const response = await axios.patch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks/${webhookId}`,
      {
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret,
          insecure_ssl: '0',
        },
        events: ['workflow_run'],
        active: true,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
        timeout: 10000,
      }
    );

    logger.info(
      { webhookId, repo: `${owner}/${repo}` },
      'Existing webhook updated on GitHub'
    );

    return response.data;
  }

  /**
   * Delete a webhook from a repository.
   * Called when a user disables monitoring on a repo.
   *
   * @param {string} token - GitHub access token
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @param {number} webhookId - The webhook ID to delete
   */
  static async deleteWebhook(token, owner, repo, webhookId) {
    try {
      await axios.delete(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/hooks/${webhookId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
          timeout: 10000,
        }
      );

      logger.info(
        { webhookId, repo: `${owner}/${repo}` },
        'Webhook deleted from GitHub'
      );

    } catch (error) {
      // 404 means the webhook was already deleted (e.g., manually on GitHub)
      if (error.response?.status === 404) {
        logger.warn({ webhookId }, 'Webhook already deleted from GitHub');
        return;
      }
      throw error;
    }
  }

  /**
   * ========================================================================
   * WORKFLOW LOG FETCHING
   * ========================================================================
   *
   * Fetches the logs for a specific GitHub Actions workflow run.
   *
   * HOW IT WORKS:
   * GitHub's API at GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs
   * returns a 302 redirect to a temporary URL hosting a ZIP file.
   * The ZIP contains one text file per job step in the workflow.
   *
   * EXAMPLE ZIP STRUCTURE:
   * logs.zip
   * ├── build/1_Set up job.txt
   * ├── build/2_Checkout code.txt
   * ├── build/3_Install dependencies.txt
   * ├── build/4_Run tests.txt          ← The failing step
   * ├── build/5_Post Checkout code.txt
   * └── build/6_Complete job.txt
   *
   * We unzip all files, concatenate the text, and pass it to LogParser.
   *
   * @param {string} token - GitHub access token
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @param {number} runId - The workflow run ID
   * @returns {Promise<Buffer>} ZIP file as a Buffer
   */
  static async fetchWorkflowLogs(token, owner, repo, runId) {
    try {
      const response = await axios.get(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/logs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
          // GitHub returns a 302 redirect to the actual log file.
          // axios follows redirects by default, but we need the response
          // as raw bytes (not text), hence responseType: 'arraybuffer'
          responseType: 'arraybuffer',
          timeout: 30000, // Logs can be large, give extra time
        }
      );

      logger.info(
        { runId, repo: `${owner}/${repo}`, size: response.data.length },
        'Workflow logs fetched successfully'
      );

      return response.data;

    } catch (error) {
      // GitHub returns 410 Gone if the logs have expired (kept for ~90 days)
      if (error.response?.status === 410) {
        logger.warn({ runId, repo: `${owner}/${repo}` }, 'Workflow logs have expired');
        return null;
      }
      logger.error({ err: error, runId }, 'Failed to fetch workflow logs');
      throw error;
    }
  }

  /**
   * Unzip GitHub Actions log archive and concatenate all log text.
   *
   * @param {Buffer} zipBuffer - The ZIP file as a Buffer
   * @returns {string} Concatenated log text from all files in the archive
   */
  static unzipLogs(zipBuffer) {
    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      const logParts = [];

      for (const entry of entries) {
        // Skip directories and non-text files
        if (entry.isDirectory) continue;

        const filename = entry.entryName;
        const content = entry.getData().toString('utf8');

        // Add a header so we know which step each log section is from
        logParts.push(`\n=== ${filename} ===\n`);
        logParts.push(content);
      }

      const combined = logParts.join('\n');

      logger.info(
        { fileCount: entries.length, totalSize: combined.length },
        'Logs unzipped and concatenated'
      );

      return combined;

    } catch (error) {
      logger.error({ err: error }, 'Failed to unzip workflow logs');
      throw new Error('Failed to unzip workflow logs: ' + error.message);
    }
  }

  /**
   * Build the GitHub OAuth authorization URL.
   * This is the URL we redirect the user to in Step 2 of the OAuth flow.
   *
   * SCOPES:
   * - "repo": Full access to repos (needed to read workflow logs)
   * - "admin:repo_hook": Permission to create/delete webhooks
   * - "read:user": Read the user's profile info
   *
   * STATE PARAMETER:
   * We include a random "state" parameter in the URL. GitHub sends it back
   * in the callback redirect. We verify it matches to prevent CSRF attacks.
   * (An attacker can't trick a user into connecting THEIR GitHub account
   * to the attacker's session because the state won't match.)
   *
   * @param {string} state - Random string to prevent CSRF
   * @returns {string} The full authorization URL
   */
  static buildAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: `${process.env.WEBHOOK_BASE_URL || 'http://localhost:3000'}/api/v1/github/callback`,
      scope: 'repo admin:repo_hook read:user',
      state,
    });

    return `${GITHUB_OAUTH_BASE}/login/oauth/authorize?${params.toString()}`;
  }
}

export default GitHubService;
