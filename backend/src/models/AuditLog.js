import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'failure-received',
        'analysis-started',
        'analysis-completed',
        'fix-applied',
        'fix-failed',
        'fix-rolled-back',
        'manual-intervention',
      ],
      index: true,
    },
    performedBy: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      enum: ['pipeline-failure', 'analysis-result', 'applied-fix'],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    changes: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    errorMessage: String,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { collection: 'audit_logs' }
);

export default mongoose.model('AuditLog', auditLogSchema);
