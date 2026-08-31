import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';
import MonitoredRepo from '../models/MonitoredRepo.js';
import User from '../models/User.js';
import PipelineFailure from '../models/PipelineFailure.js';
import GitHubService from '../services/githubService.js';
import LogParser from '../services/logParser.js';
import { decrypt } from '../utils/encryption.js';
import { getQueues } from '../queues/index.js';

/**
 * ============================================================================
 * WEBHOOK CONTROLLER — Receives and Validates GitHub Webhook Events
 * ============================================================================
 *
 * This controller handles incoming webhook events from GitHub.
 * When a GitHub Actions workflow_run fails, this is the entry point that
 * triggers the entire automated analysis pipeline.
 *
 * ┌──────────┐    POST /webhook/github    ┌──────────────┐
 * │  GitHub   │ ──────────────────────────>│ This Handler │
 * │ (sender)  │    X-Hub-Signature-256     │              │
 * └──────────┘    X-GitHub-Event           │ 1. Validate  │
 *                                          │ 2. Fetch logs│
 *                                          │ 3. Parse     │
 *                                          │ 4. Queue     │
 *                                          └──────────────┘
 *
 * SECURITY: HMAC-SHA256 SIGNATURE VERIFICATION
 * ============================================
 *
 * GitHub signs every webhook payload using HMAC-SHA256 with the secret
 * we provided when creating the webhook. Here's how it works:
 *
 * ON GITHUB'S SIDE (when sending the webhook):
 * 1. GitHub serializes the event payload to JSON bytes
 * 2. GitHub computes: HMAC-SHA256(webhook_secret, json_bytes) → hex digest
 * 3. GitHub sends the request with header:
 *    X-Hub-Signature-256: sha256=<hex_digest>
 *
 * ON OUR SIDE (when receiving the webhook):
 * 1. We receive the raw HTTP body (bytes, NOT parsed JSON)
 * 2. We look up the webhook secret from our database
 * 3. We compute: HMAC-SHA256(stored_secret, raw_body) → hex digest
 * 4. We compare our computed digest with the one in the header
 * 5. If they match → the request is genuine and unmodified
 *    If they don't → the request is forged or tampered with
 *
 * WHY RAW BODY IS CRITICAL:
 * If we used the parsed JSON object (after express.json()), the byte
 * representation might differ from what GitHub sent. For example:
 * - JSON.parse then JSON.stringify may reorder keys
 * - Whitespace may change
 * - Unicode escaping may differ
 * These changes would produce a different HMAC hash, and signature
 * verification would ALWAYS fail. That's why the webhook route uses
 * express.raw() to get the exact bytes GitHub sent.
 *
 * WHY TIMING-SAFE COMPARISON:
 * Regular string comparison (a === b) returns false as soon as it finds
 * the first mismatched character. An attacker could measure how long the
 * comparison takes to figure out how many characters of their forged
 * signature are correct (a "timing attack"). crypto.timingSafeEqual()
 * always takes the same amount of time regardless of where the mismatch
 * is, preventing this attack.
 * ============================================================================
 */

class WebhookController {
  /**
   * Receive and process a GitHub webhook event.
   *
   * IMPORTANT: The route for this handler uses express.raw({ type: 'application/json' })
   * instead of express.json(). This means req.body is a Buffer of raw bytes, NOT a
   * parsed JSON object. We parse it ourselves AFTER validating the signature.
   */
  static async receiveGitHubWebhook(req, res) {
    const startTime = Date.now();

    try {
      // ── STEP 1: Extract headers ────────────────────────────────────────
      const signature = req.headers['x-hub-signature-256'];
      const event = req.headers['x-github-event'];
      const deliveryId = req.headers['x-github-delivery'];

      logger.info(
        { event, deliveryId, hasSignature: !!signature },
        'GitHub webhook received'
      );

      // The raw body is a Buffer because we used express.raw()
      // This is the EXACT byte sequence GitHub sent — critical for HMAC
      const rawBody = req.body;

      if (!rawBody || rawBody.length === 0) {
        return res.status(400).json({ error: 'Empty request body' });
      }

      // Parse the JSON payload (we do this manually since we used express.raw())
      let payload;
      try {
        const bodyText = rawBody.toString('utf8');
        const jsonText = bodyText.startsWith('payload=')
          ? new URLSearchParams(bodyText).get('payload')
          : bodyText;

        if (!jsonText) throw new Error('Missing payload field');
        payload = JSON.parse(jsonText);
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      // ── STEP 2: Identify the repository ────────────────────────────────
      // GitHub includes the repository info in every webhook payload
      const repoFullName = payload.repository?.full_name;
      if (!repoFullName) {
        logger.warn('Webhook payload missing repository.full_name');
        return res.status(400).json({ error: 'Missing repository information' });
      }

      // Look up the monitoring record for this repo
      const monitoredRepo = await MonitoredRepo.findOne({
        repoFullName,
        isActive: true,
      });

      if (!monitoredRepo) {
        logger.warn({ repoFullName }, 'Webhook received for unmonitored repo');
        return res.status(404).json({ error: 'Repository is not monitored' });
      }

      // ── STEP 3: Verify HMAC-SHA256 signature ──────────────────────────
      //
      // This is the core security check. We verify that:
      // a) The request actually came from GitHub (not a spoofed request)
      // b) The payload was not modified in transit
      //
      if (signature) {
        const isValid = WebhookController.verifySignature(
          rawBody,                      // The exact bytes GitHub sent
          signature,                    // The signature from the header
          monitoredRepo.webhookSecret   // The secret we stored when creating the webhook
        );

        if (!isValid) {
          logger.warn(
            { repoFullName, deliveryId },
            'Webhook signature verification FAILED — possible forgery'
          );
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        logger.info({ repoFullName }, 'Webhook signature verified ✓');
      } else {
        // No signature means the webhook was created without a secret
        // In production, you should ALWAYS require signatures
        logger.warn({ repoFullName }, 'Webhook received without signature — skipping verification');
      }

      // ── STEP 4: Handle the event ──────────────────────────────────────
      // We only care about the "ping" event (webhook test) and "workflow_run"
      // (GitHub Actions workflow completed/failed)

      // Handle ping event (sent when webhook is first created)
      if (event === 'ping') {
        logger.info({ repoFullName }, 'Webhook ping received — webhook is working');
        return res.status(200).json({ message: 'pong', repoFullName });
      }

      // We only process workflow_run events
      if (event !== 'workflow_run') {
        logger.debug({ event, repoFullName }, 'Ignoring non-workflow_run event');
        return res.status(200).json({ message: `Event '${event}' ignored` });
      }

      // ── STEP 5: Check if the workflow run failed ──────────────────────
      const workflowRun = payload.workflow_run;

      if (!workflowRun) {
        return res.status(200).json({ message: 'No workflow_run in payload' });
      }

      // Only process completed runs (not "requested" or "in_progress")
      if (payload.action !== 'completed') {
        logger.debug(
          { action: payload.action, repoFullName },
          'Workflow run not completed yet, ignoring'
        );
        return res.status(200).json({ message: `Action '${payload.action}' ignored` });
      }

      // Only process failures (not success, cancelled, etc.)
      if (workflowRun.conclusion !== 'failure') {
        logger.debug(
          { conclusion: workflowRun.conclusion, repoFullName },
          'Workflow run did not fail, ignoring'
        );
        return res.status(200).json({
          message: `Conclusion '${workflowRun.conclusion}' is not a failure`,
        });
      }

      // ── STEP 6: Fetch workflow logs from GitHub ───────────────────────
      logger.info(
        {
          repoFullName,
          runId: workflowRun.id,
          workflowName: workflowRun.name,
          conclusion: workflowRun.conclusion,
        },
        'Failed workflow detected — fetching logs'
      );

      // Get the user who owns this repo to decrypt their GitHub token
      const user = await User.findById(monitoredRepo.userId);
      if (!user) {
        logger.error({ userId: monitoredRepo.userId }, 'User not found for monitored repo');
        return res.status(500).json({ error: 'User not found' });
      }

      // Decrypt the user's GitHub access token
      const accessToken = decrypt(
        user.accessToken,
        user.accessTokenIv,
        user.accessTokenTag
      );

      const [owner, repo] = repoFullName.split('/');
      let logText = '';

      try {
        // Fetch the log ZIP from GitHub Actions
        const zipBuffer = await GitHubService.fetchWorkflowLogs(
          accessToken,
          owner,
          repo,
          workflowRun.id
        );

        if (zipBuffer) {
          // Unzip and concatenate all log files
          logText = GitHubService.unzipLogs(zipBuffer);
        } else {
          logText = `Workflow "${workflowRun.name}" failed with conclusion "${workflowRun.conclusion}". Logs unavailable.`;
        }
      } catch (logError) {
        logger.warn({ err: logError }, 'Failed to fetch workflow logs, using payload info');
        logText = `Workflow "${workflowRun.name}" failed.\n` +
          `Conclusion: ${workflowRun.conclusion}\n` +
          `Run URL: ${workflowRun.html_url}\n` +
          `Head branch: ${workflowRun.head_branch}\n` +
          `Head SHA: ${workflowRun.head_sha}\n`;
      }

      // ── STEP 7: Parse logs and create failure record ──────────────────
      // This connects to the existing pipeline: LogParser → LLM → AnalysisResult

      const failure = new PipelineFailure({
        pipelineId: workflowRun.id.toString(),
        pipelineName: workflowRun.name || 'GitHub Actions',
        cicdProvider: 'github-actions',
        commitSha: workflowRun.head_sha || 'unknown',
        commitAuthor: workflowRun.head_commit?.author?.name || workflowRun.actor?.login,
        repositoryUrl: `https://github.com/${repoFullName}`,
        branch: workflowRun.head_branch,
        logs: {
          raw: logText,
          truncated: logText.length > 8000,
          size: logText.length,
        },
        failureType: 'unknown', // Will be inferred by the LLM
        webhookPayload: payload,
        status: 'pending-analysis',
      });

      const saved = await failure.save();

      // Update the last event timestamp on the monitored repo
      monitoredRepo.lastEventAt = new Date();
      await monitoredRepo.save();

      // ── STEP 8: Queue for LLM analysis ────────────────────────────────
      // This reuses the existing BullMQ analysis queue from queues/index.js
      // The analysis worker will:
      // 1. Call LogParser.extractKeyInfo() to parse the logs
      // 2. Call llmService.analyzeFailure() to get root cause + fixes
      // 3. Store the AnalysisResult in MongoDB

      const queues = await getQueues();
      const job = await queues.analysisQueue.add(
        'analyze-failure',
        {
          failureId: saved._id,
          context: {
            repositoryUrl: `https://github.com/${repoFullName}`,
            branch: workflowRun.head_branch,
            commitSha: workflowRun.head_sha,
          },
        },
        {
          jobId: uuidv4(),
          priority: 10, // High priority for webhook-triggered analyses
        }
      );

      const processingTime = Date.now() - startTime;
      logger.info(
        {
          failureId: saved._id,
          jobId: job.id,
          repoFullName,
          processingTime,
        },
        'Webhook processed — failure queued for LLM analysis'
      );

      // Always respond 200 to GitHub quickly to avoid webhook timeout (10s)
      return res.status(200).json({
        message: 'Webhook processed successfully',
        failureId: saved._id.toString(),
        jobId: job.id,
      });

    } catch (error) {
      logger.error({ err: error }, 'Webhook processing error');
      // Still return 200 to GitHub to avoid retries for application-level errors
      // GitHub retries on 4xx/5xx, which could cause duplicate processing
      return res.status(200).json({
        message: 'Webhook received but processing failed',
        error: error.message,
      });
    }
  }

  /**
   * ========================================================================
   * HMAC-SHA256 SIGNATURE VERIFICATION
   * ========================================================================
   *
   * This is the core security function that validates webhook authenticity.
   *
   * WHAT IS HMAC?
   * HMAC = Hash-based Message Authentication Code
   * It combines a secret key with a hash function (SHA-256) to produce
   * a fixed-size "signature" for a message. Only someone who knows the
   * secret key can produce the correct signature for a given message.
   *
   * THE MATH (simplified):
   * HMAC-SHA256(key, message) = SHA256( (key XOR opad) || SHA256( (key XOR ipad) || message ) )
   * - ipad = 0x36 repeated, opad = 0x5c repeated
   * - The double-hashing with XOR makes HMAC resistant to length extension attacks
   *
   * CONCRETE EXAMPLE:
   * Secret:  "my-webhook-secret-abc123"
   * Payload: '{"action":"completed","workflow_run":{"conclusion":"failure"}}'
   *
   * HMAC = crypto.createHmac('sha256', secret).update(payload).digest('hex')
   *      = "a1b2c3d4e5f6..."  (64 hex chars = 256 bits)
   *
   * GitHub sends: X-Hub-Signature-256: sha256=a1b2c3d4e5f6...
   * We compute:   sha256=a1b2c3d4e5f6...
   * They match ✓  → Request is authentic
   *
   * @param {Buffer} rawBody - The raw HTTP request body (exact bytes)
   * @param {string} signature - The X-Hub-Signature-256 header value
   * @param {string} secret - The webhook secret stored in our database
   * @returns {boolean} True if the signature is valid
   */
  static verifySignature(rawBody, signature, secret) {
    // Step 1: Compute our own HMAC-SHA256 over the raw body
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const computedDigest = hmac.digest('hex');

    // Step 2: Format our computed signature to match GitHub's format
    // GitHub sends: "sha256=<hex_digest>"
    const computedSignature = `sha256=${computedDigest}`;

    // Step 3: Compare using timing-safe comparison
    //
    // WHY NOT JUST USE === ?
    // Regular comparison: "sha256=abc" === "sha256=abd"
    //   - Compares char by char: 's'='s' ✓, 'h'='h' ✓, ..., 'c'≠'d' ✗ → false
    //   - Returns as soon as it finds the first mismatch
    //   - An attacker can measure the time: longer = more chars correct
    //   - By trying millions of signatures, they can brute-force char by char
    //
    // Timing-safe comparison: crypto.timingSafeEqual(a, b)
    //   - Always compares ALL bytes, even after finding a mismatch
    //   - Takes the same time regardless of where the mismatch is
    //   - Attacker can't learn anything from timing measurements
    //
    const bufComputed = Buffer.from(computedSignature, 'utf8');
    const bufReceived = Buffer.from(signature, 'utf8');

    // timingSafeEqual requires buffers of equal length
    if (bufComputed.length !== bufReceived.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufComputed, bufReceived);
  }
}

export default WebhookController;
