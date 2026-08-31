import express from 'express';
import WebhookController from '../controllers/webhook.controller.js';

const router = express.Router();

/**
 * ============================================================================
 * WEBHOOK ROUTES
 * ============================================================================
 *
 * POST /webhook/github — Receives webhook events from GitHub
 *
 * CRITICAL: RAW BODY PARSING
 * ==========================
 * This route uses express.raw() instead of express.json() for the body parser.
 *
 * WHY:
 * GitHub signs the webhook payload using HMAC-SHA256 over the raw bytes
 * of the HTTP body. To verify the signature, we need the EXACT same bytes
 * that GitHub used when computing the HMAC.
 *
 * If we used express.json(), the middleware would:
 * 1. Read the raw bytes from the network
 * 2. Parse them as JSON → JavaScript object
 * 3. Set req.body = the JavaScript object
 * 4. Discard the raw bytes
 *
 * But we need the raw bytes for HMAC verification! And if we tried to
 * reconstruct them with JSON.stringify(req.body), the result might differ
 * from the original bytes due to:
 * - Key ordering differences (JSON spec doesn't guarantee order)
 * - Whitespace differences
 * - Unicode escape sequences (e.g., \u00e9 vs é)
 * - Number formatting (1.0 vs 1)
 *
 * So instead, we use express.raw({ type: 'application/json' }) which:
 * 1. Reads the raw bytes from the network
 * 2. Sets req.body = Buffer containing the raw bytes
 * 3. We manually JSON.parse(req.body) AFTER verifying the signature
 *
 * SEQUENCE:
 * Raw bytes → HMAC verification → JSON.parse → process event
 * (not: Raw bytes → JSON.parse → attempt HMAC → ❌ different bytes)
 * ============================================================================
 */

// express.raw() keeps both JSON and legacy form-encoded deliveries as Buffers
// so the controller can verify the original bytes before parsing either format.
router.post(
  '/github',
  express.raw({ type: '*/*', limit: '10mb' }),
  WebhookController.receiveGitHubWebhook
);

export default router;
