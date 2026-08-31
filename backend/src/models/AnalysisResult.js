import mongoose from 'mongoose';

const analysisResultSchema = new mongoose.Schema(
  {
    failureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PipelineFailure',
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    rootCause: {
      type: String,
      required: true,
    },
    rootCauseConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    suggestedFixes: [
      {
        id: String,
        title: String,
        description: String,
        severity: {
          type: String,
          enum: ['critical', 'high', 'medium', 'low'],
        },
        isSafe: {
          type: Boolean,
          default: false,
        },
        safetyReason: String,
        estimatedTime: String, // e.g., "5 minutes"
        commands: [String],
        fileChanges: [
          {
            file: String,
            operation: {
              type: String,
              enum: ['create', 'update', 'delete'],
            },
            content: String,
          },
        ],
        risks: [String],
        benefits: [String],
      },
    ],
    analysisDetails: {
      llmModel: String,
      llmProvider: String,
      analysisTime: Number, // in milliseconds
      tokensUsed: {
        input: Number,
        output: Number,
      },
      temperature: Number,
    },
    relatedIssues: [String], // URLs or issue keys
    relatedDocumentation: [String], // URLs
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    error: {
      message: String,
      code: String,
      details: mongoose.Schema.Types.Mixed,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: Date,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days TTL
      index: true,
    },
  },
  { collection: 'analysis_results' }
);

// TTL Index
analysisResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AnalysisResult', analysisResultSchema);
