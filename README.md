# LLM-Powered DevOps CI/CD Failure Analysis & Auto-Fix

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

Automatically analyze CI/CD pipeline failures using LLMs, detect root causes, and safely suggest or apply fixes with minimal human intervention.

</div>

---

## 🎯 Overview

This production-grade microservices system leverages Large Language Models (LLMs) to:

- **Analyze** CI/CD pipeline failures from logs
- **Summarize** complex errors into actionable insights
- **Detect** root causes with confidence scoring
- **Suggest** safe, tested fixes with detailed explanations
- **Apply** safe fixes automatically (rule-based execution)
- **Track** all fixes and results in an audit log

## 🚀 Key Features

- ✅ **Multi-Provider Support**: GitHub Actions, Jenkins, GitLab CI, CircleCI, custom solutions
- ✅ **LLM Integration**: OpenAI, Anthropic Claude, Local Ollama
- ✅ **Async Processing**: BullMQ job queue with automatic retry
- ✅ **Safe Auto-Fix**: Built-in safety checks prevent dangerous operations
- ✅ **Production Ready**: Docker, Helm, CI/CD pipeline deployable
- ✅ **Comprehensive Logging**: Audit trail for all operations
- ✅ **API First**: RESTful API with authentication and rate limiting
- ✅ **Database**: MongoDB for persistence + Redis for caching/queues

## 📋 System Architecture

```
┌─────────────────┐
│ CI/CD Providers │ (GitHub Actions, Jenkins, GitLab, etc.)
│  (Webhooks)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  API Gateway & Webhook Handler      │
│  • Signature Validation              │
│  • Provider Detection                │
│  • Rate Limiting                     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Job Queue (BullMQ + Redis)         │
│  • pipeline-analysis                 │
│  • auto-fix                          │
│  • notifications                     │
└────────┬───────────────┬────────────┘
         │               │
         ▼               ▼
    ┌─────────┐    ┌──────────┐
    │ Workers │    │ Workers  │
    │         │    │          │
    ├─────────┤    ├──────────┤
    │ LogParser   │ FixEngine│
    │ LLMService  │ Executor │
    └────┬────┘    └────┬─────┘
         │               │
         └───────┬───────┘
                 ▼
         ┌──────────────┐
         │ MongoDB      │
         │ (Results)    │
         └──────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 18+ | JavaScript runtime |
| **Framework** | Express.js | HTTP server |
| **Database** | MongoDB | Document storage |
| **Cache/Queue** | Redis + BullMQ | Job queue & caching |
| **LLM Integrations** | Axios | API client |
| **Logging** | Pino | Structured logging |
| **Security** | Helmet, CORS | HTTP security |
| **Container** | Docker | Containerization |
| **Orchestration** | Docker Compose | Local/staging |

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **MongoDB** 6.0+
- **Redis** 7+
- **LLM Access** (OpenAI, Anthropic, or local Ollama)

### Local Development

#### 1. Clone and Setup

```bash
cd backend
npm install
cp .env.example .env
```

#### 2. Configure Environment

Edit `.env`:

```bash
# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Database
MONGODB_URI=mongodb://localhost:27017/llm-devops-assistant

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM Provider (choose one)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-turbo

# Security
API_KEY=dev-api-key-12345
GITHUB_WEBHOOK_SECRET=webhook-secret

# Features
ENABLE_AUTO_FIX=true
ENABLE_SAFE_FIX_ONLY=true
```

#### 3. Start Services

```bash
# In separate terminals

# Terminal 1: MongoDB
mongod --dbpath ./data

# Terminal 2: Redis
redis-server

# Terminal 3: Node server
npm run dev
```

#### 4. Test the API

```bash
curl -X GET http://localhost:3000/health \
  -H "X-API-Key: dev-api-key-12345"
```

### Docker Deployment

#### All-in-One

```bash
docker-compose up -d
```

Services available:
- API: http://localhost:3000
- MongoDB: localhost:27017
- Redis: localhost:6379

#### Verify

```bash
# Check API health
curl http://localhost:3000/health

# View logs
docker-compose logs -f api
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1/analyze
```

### Authentication

All endpoints (except `/health`) require either:
- **API Key**: `X-API-Key: your-api-key`
- **Bearer Token**: `Authorization: Bearer <token>`

### Core Endpoints

#### 1. Submit Failure for Analysis

**POST** `/submit`

Submit logs for LLM analysis.

```bash
curl -X POST http://localhost:3000/api/v1/analyze/submit \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "logs": "Error: Cannot find module '\''express'\''",
    "pipelineId": "workflow-123",
    "pipelineName": "CI/CD Build",
    "cicdProvider": "github-actions",
    "branch": "main",
    "commitSha": "abc123def456"
  }'
```

**Response:**
```json
{
  "success": true,
  "failureId": "507f1f77bcf86cd799439011",
  "jobId": "1234-5678-9101",
  "message": "Failure submitted for analysis",
  "status": "queued"
}
```

#### 2. Receive GitHub Actions Webhook

**POST** `/webhook`

```bash
# Automatic signature validation with GitHub webhook
# Add to GitHub: Settings > Webhooks
# Payload URL: https://your-domain.com/api/v1/analyze/webhook
# Events: Workflow runs (failed)
```

#### 3. Get Analysis Result

**GET** `/analysis/{analysisId}`

```bash
curl http://localhost:3000/api/v1/analyze/analysis/507f1f77bcf86cd799439012 \
  -H "X-API-Key: your-api-key"
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "_id": "507f1f77bcf86cd799439012",
    "summary": "Module 'express' is missing from node_modules",
    "rootCause": "Dependencies not installed properly - npm install or npm ci not executed",
    "confidence": 0.92,
    "suggestedFixes": [
      {
        "id": "fix-001",
        "title": "Install Dependencies",
        "description": "Run npm ci to install exact dependencies",
        "isSafe": true,
        "commands": ["npm ci"],
        "risks": [],
        "benefits": ["Resolves missing module error"],
        "estimatedTime": "5 minutes"
      }
    ]
  }
}
```

#### 4. List Failures

**GET** `/failures`

```bash
curl "http://localhost:3000/api/v1/analyze/failures?limit=20&status=analyzed" \
  -H "X-API-Key: your-api-key"
```

#### 5. Apply a Fix

**POST** `/fix/apply`

```bash
curl -X POST http://localhost:3000/api/v1/analyze/fix/apply \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "analysisId": "507f1f77bcf86cd799439012",
    "fixId": "fix-001",
    "appliedByUser": "developer@company.com"
  }'
```

#### 6. Get Statistics

**GET** `/stats`

```bash
curl http://localhost:3000/api/v1/analyze/stats \
  -H "X-API-Key: your-api-key"
```

---

## 🔌 CI/CD Integration

### GitHub Actions

#### Webhook Setup

1. Go to **Settings > Webhooks > Add webhook**
2. Set **Payload URL**: `https://your-domain.com/api/v1/analyze/webhook`
3. Select **Workflow runs** events
4. Set **Secret**: Use your `GITHUB_WEBHOOK_SECRET`

#### Action Workflow Example

```yaml
name: Pipeline Failure Analysis
on:
  workflow_run:
    types: [completed]

jobs:
  analyze:
    if: ${{ failure() }}
    runs-on: ubuntu-latest
    steps:
      - name: Get workflow logs
        run: |
          zip -r logs.zip .
      
      - name: Send to LLM Assistant
        run: |
          curl -X POST https://your-domain.com/api/v1/analyze/submit \
            -H "X-API-Key: ${{ secrets.LLM_ASSISTANT_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "logs": "${{ job.log }}",
              "pipelineId": "${{ github.run_id }}",
              "pipelineName": "${{ github.workflow }}",
              "cicdProvider": "github-actions",
              "branch": "${{ github.ref }}",
              "commitSha": "${{ github.sha }}"
            }'
```

### Jenkins

#### Script Example

```groovy
pipeline {
    post {
        failure {
            script {
                def logs = currentBuild.getRawBuild().getLog(1000).join('\n')
                
                sh '''
                curl -X POST http://localhost:3000/api/v1/analyze/submit \
                  -H "X-API-Key: ${LLM_API_KEY}" \
                  -H "Content-Type: application/json" \
                  -d '{
                    "logs": "'" + logs + "'",
                    "pipelineId": "' + env.BUILD_ID + '",
                    "pipelineName": "' + env.JOB_NAME + '",
                    "cicdProvider": "jenkins",
                    "branch": "' + env.GIT_BRANCH + '",
                    "commitSha": "' + env.GIT_COMMIT + '"
                  }'
                '''
            }
        }
    }
}
```

### cURL Example

```bash
# Manual failure submission
curl -X POST http://localhost:3000/api/v1/analyze/submit \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d @failure.json
```

Where `failure.json`:
```json
{
  "logs": "npm ERR! code ENOENT\nnpm ERR! syscall...",
  "pipelineId": "pipeline-12345",
  "pipelineName": "Build & Deploy",
  "cicdProvider": "github-actions",
  "branch": "develop",
  "commitSha": "a1b2c3d4e5f6"
}
```

---

## 🔒 Security

### Features

- ✅ **API Key Authentication**: Required for all protected endpoints
- ✅ **Webhook Signature Validation**: GitHub webhook verification
- ✅ **Rate Limiting**: 100 requests per 15 minutes per API key
- ✅ **Safe Auto-Fix**: Whitelist-based command execution
- ✅ **Log Sanitization**: Removes credentials and PII
- ✅ **CORS**: Configurable cross-origin support
- ✅ **Helmet**: HTTP security headers

### Dangerous Operations Blocked

The fix engine **refuses to execute**:
- `rm -rf /` - Destructive deletion
- `dd if=` - Low-level disk operations
- Fork bombs
- Kernel module commands
- Filesystem formatting
- Database data deletion
- Git push/publish commands

### Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Rotate regularly, use strong values
3. **Database**: Enable MongoDB authentication in production
4. **Redis**: Use password authentication
5. **HTTPS**: Always use SSL/TLS in production
6. **Network**: Use VPC/private networks when possible
7. **Monitoring**: Set up alerts for failed operations

---

## 📊 Monitoring & Logs

### Health Check

```bash
curl http://localhost:3000/health
```

### View Logs

```bash
# Docker
docker-compose logs -f api

# Local
npm run dev
```

### Metrics Tracked

- **Analysis completion time**: LLM response latency
- **Fix success rate**: % of fixes applied successfully
- **Processing rate**: Failures analyzed per minute
- **Queue depth**: Pending jobs

---

## 🧪 Testing

```bash
# Install dev dependencies
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Generate coverage
npm run test:coverage
```

---

## 📈 Production Deployment

### Kubernetes

```bash
# Build image
docker build -t llm-devops-api:1.0.0 ./backend

# Push to registry
docker tag llm-devops-api:1.0.0 your-registry/llm-devops-api:1.0.0
docker push your-registry/llm-devops-api:1.0.0

# Deploy with Helm (example)
helm install llm-devops ./helm-chart \
  --set image.tag=1.0.0 \
  --set mongodbUri=mongodb://prod-cluster \
  --set redisHost=redis-cluster
```

### AWS ECS/Fargate

```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker tag llm-devops-api:1.0.0 YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/llm-devops-api:1.0.0
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/llm-devops-api:1.0.0
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/improvement`)
3. Commit changes (`git commit -am 'Add feature'`)
4. Push branch (`git push origin feature/improvement`)
5. Create Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 📞 Support

- **Documentation**: See `API.md`, `DEPLOYMENT.md`, `SECURITY.md`
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

---

## 🗺️ Roadmap

- [ ] Dashboard UI for results visualization
- [ ] Slack/Teams notifications
- [ ] Custom fix templates
- [ ] Machine learning confidence improvements
- [ ] Multi-organization support
- [ ] SAML/OIDC authentication
- [ ] Kubernetes operator

---

## 🙏 Acknowledgments

Built with:
- OpenAI GPT-4 / Claude 3
- Express.js
- MongoDB
- Redis
- BullMQ

---

<div align="center">

**[Report Bug](https://github.com/issues)** • **[Request Feature](https://github.com/issues)**

Made with ❤️ for DevOps Engineers

</div>
