import express from 'express';
import GitHubController from '../controllers/github.controller.js';
import { authenticateRequest } from '../middleware/auth.js';

const router = express.Router();

/**
 * ============================================================================
 * GITHUB ROUTES
 * ============================================================================
 *
 * PUBLIC ROUTES (no auth required):
 *   GET /api/v1/github/auth     → Start OAuth flow (redirects to GitHub)
 *   GET /api/v1/github/callback → Handle OAuth callback (exchanges code for token)
 *
 * PROTECTED ROUTES (require JWT Bearer token):
 *   GET    /api/v1/github/me              → Current user profile
 *   GET    /api/v1/github/repos           → List user's repos
 *   POST   /api/v1/github/repos/monitor   → Enable monitoring on a repo
 *   DELETE /api/v1/github/repos/monitor   → Disable monitoring on a repo
 *   GET    /api/v1/github/repos/monitored → List all monitored repos
 *   GET    /api/v1/github/dashboard       → Analysis results dashboard
 * ============================================================================
 */

// ── Public: OAuth flow (no auth needed) ──────────────────────────────────
router.get('/auth', GitHubController.startOAuth);
router.get('/callback', GitHubController.handleCallback);

// ── Protected: User profile ──────────────────────────────────────────────
router.get('/me', authenticateRequest, GitHubController.getCurrentUser);

// ── Protected: Repository management ─────────────────────────────────────
router.get('/repos', authenticateRequest, GitHubController.listRepos);
router.post('/repos/monitor', authenticateRequest, GitHubController.enableMonitoring);
router.delete('/repos/monitor', authenticateRequest, GitHubController.disableMonitoring);
router.get('/repos/monitored', authenticateRequest, GitHubController.listMonitored);

// ── Protected: Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', authenticateRequest, GitHubController.getDashboard);

export default router;
