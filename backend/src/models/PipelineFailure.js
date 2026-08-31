import mongoose from 'mongoose';

const pipelineFailureSchema = new mongoose.Schema(
  {
    pipelineId: {
      type: String,
      required: true,
      index: true,
    },
    pipelineName: {
      type: String,
      required: true,
    },
    cicdProvider: {
      type: String,
      enum: ['github-actions', 'jenkins', 'gitlab-ci', 'circleci', 'unknown', 'other'],
      required: true,
    },
    commitSha: {
      type: String,
      required: true,
      index: true,
    },
    commitAuthor: String,
    repositoryUrl: String,
    branch: String,
    logs: {
      raw: String,
      truncated: Boolean,
      size: Number,
    },
    failureType: {
      type: String,
      enum: [
        'build',
        'test',
        'deployment',
        'security-scan',
        'performance',
        'lint',
        'unknown',
      ],
      default: 'unknown',
    },
    webhookPayload: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending-analysis', 'analyzing', 'analyzed', 'failed'],
      default: 'pending-analysis',
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: Date,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days TTL
      index: true,
    },
  },
  { collection: 'pipeline_failures' }
);

// TTL Index for automatic cleanup
pipelineFailureSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PipelineFailure', pipelineFailureSchema);
