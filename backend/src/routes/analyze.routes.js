import express from 'express';
import AnalyzeController from '../controllers/analyze.controller.js';
import { validateRequest, validateAnalysisId } from '../middleware/validation.js';
import { authenticateRequest } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

/**
 * Health & Status Endpoints
 */
router.get('/health', AnalyzeController.getHealth);
router.get('/stats', authenticateRequest, AnalyzeController.getStats);

/**
 * Failure Submission Endpoints
 */
router.post(
  '/submit',
  rateLimit,
  validateRequest({
    logs: { required: true, type: 'string' },
    pipelineId: { required: true, type: 'string' },
    pipelineName: { required: false, type: 'string' },
    cicdProvider: { required: false, type: 'string' },
    commitSha: { required: false, type: 'string' },
    branch: { required: false, type: 'string' },
  }),
  AnalyzeController.submitFailure
);

/**
 * Webhook Endpoints (CI/CD Providers)
 */
router.post('/webhook', rateLimit, AnalyzeController.receiveWebhook);

/**
 * Analysis Endpoints
 */
router.get(
  '/analysis/:analysisId',
  authenticateRequest,
  validateAnalysisId,
  AnalyzeController.getAnalysis
);

/**
 * Failure Details Endpoints
 */
router.get('/failures', authenticateRequest, AnalyzeController.listFailures);
router.get(
  '/failures/:failureId',
  authenticateRequest,
  AnalyzeController.getFailure
);

/**
 * Fix Application Endpoints
 */
router.post(
  '/fix/apply',
  authenticateRequest,
  rateLimit,
  validateRequest({
    analysisId: { required: true, type: 'string' },
    fixId: { required: true, type: 'string' },
    appliedByUser: { required: false, type: 'string' },
  }),
  AnalyzeController.applyFix
);

router.get(
  '/failures/:failureId/fixes',
  authenticateRequest,
  AnalyzeController.getAppliedFixes
);

export default router;
