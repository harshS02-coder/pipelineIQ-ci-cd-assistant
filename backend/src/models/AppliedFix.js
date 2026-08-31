import mongoose from 'mongoose';

const appliedFixSchema = new mongoose.Schema(
  {
    analysisResultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnalysisResult',
      required: true,
      index: true,
    },
    failureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PipelineFailure',
      required: true,
      index: true,
    },
    fixId: {
      type: String,
      required: true,
    },
    fixTitle: String,
    appliedBy: {
      type: String,
      enum: ['auto-fix', 'manual', 'api'],
      default: 'manual',
    },
    appliedByUser: String, // User ID or API key
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'success', 'failed', 'rolled-back'],
      default: 'pending',
      index: true,
    },
    executionDetails: {
      startTime: Date,
      endTime: Date,
      duration: Number, // in milliseconds
      commands: [
        {
          command: String,
          output: String,
          exitCode: Number,
          executedAt: Date,
        },
      ],
      fileChanges: [
        {
          file: String,
          before: String,
          after: String,
          timestamp: Date,
        },
      ],
    },
    verificationResult: {
      passed: Boolean,
      checks: [
        {
          name: String,
          passed: Boolean,
          output: String,
        },
      ],
      timestamp: Date,
    },
    rollbackInfo: {
      isRolledBack: Boolean,
      rollbackReason: String,
      rollbackTime: Date,
      rollbackStatus: String,
    },
    artifacts: [
      {
        name: String,
        url: String,
        size: Number,
        mimeType: String,
      },
    ],
    logs: String,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: Date,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year TTL
      index: true,
    },
  },
  { collection: 'applied_fixes' }
);

// TTL Index
appliedFixSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AppliedFix', appliedFixSchema);
