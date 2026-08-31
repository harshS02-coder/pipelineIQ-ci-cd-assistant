# Quick Start Guide

Get the LLM DevOps Assistant running in 5 minutes! 

## Prerequisites

- ✅ Docker & Docker Compose
- ✅ curl or Postman

## 🚀 5-Minute Setup

### Step 1: Clone & Navigate
```bash
cd backend
```

### Step 2: Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your LLM API key:
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key
```

### Step 3: Start Services
```bash
docker-compose up -d
```

Wait 10 seconds for services to start...

### Step 4: Verify Setup
```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-03-27T10:30:00Z",
  "uptime": 5
}
```

### Step 5: Submit Your First Failure!

```bash
curl -X POST http://localhost:3000/api/v1/analyze/submit \
  -H "X-API-Key: dev-api-key-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "logs": "npm ERR! Cannot find module express",
    "pipelineId": "test-123",
    "pipelineName": "Build Pipeline",
    "cicdProvider": "github-actions"
  }'
```

Response:
```json
{
  "success": true,
  "failureId": "507f1f77bcf86cd799439011",
  "jobId": "abc-123",
  "message": "Failure submitted for analysis",
  "status": "queued"
}
```

Save the `failureId` for next step!

### Step 6: Get Analysis Results

```bash
# Wait 5-10 seconds, then check results:
curl http://localhost:3000/api/v1/analyze/failures/507f1f77bcf86cd799439011 \
  -H "X-API-Key: dev-api-key-12345"
```

## 📊 Expected Response

```json
{
  "success": true,
  "failure": { ... },
  "analysis": {
    "summary": "Module 'express' is missing from node_modules",
    "rootCause": "Dependencies not installed",
    "confidence": 0.92,
    "suggestedFixes": [
      {
        "id": "fix-001",
        "title": "Install Dependencies",
        "description": "Run npm ci to install...",
        "commands": ["npm ci"],
        "isSafe": true
      }
    ]
  }
}
```

## 🎯 What's Happening

1. **Submission** → Your logs are received
2. **Queuing** → Job added to processing queue  
3. **Parsing** → Logs analyzed for errors
4. **LLM Analysis** → Sent to OpenAI for intelligence
5. **Result Storage** → Results saved to MongoDB
6. **Retrieval** → You fetch the results

## 📚 Next Steps

### Try Different Log Types
```bash
# Build error
"logs": "error TS1234: Cannot find module..."

# Test failure
"logs": "FAILED: test/suite.test.js\n  1) should return 200"

# Deployment error  
"logs": "Failed to deploy: Connection timeout"
```

### Integrate with CI/CD

**GitHub Actions**: See `examples/github-actions-workflow.yml`
**Jenkins**: See `examples/Jenkinsfile`
**Manual**: See `examples/submit-failure.sh`

### API Documentation

Full API reference: [API.md](../API.md)

Common endpoints:
- `POST /api/v1/analyze/submit` - Submit failure
- `GET  /api/v1/analyze/failures` - List failures
- `GET  /api/v1/analyze/failures/{id}` - Get details
- `POST /api/v1/analyze/fix/apply` - Apply a fix

## 🔧 Common Tasks

### View Logs
```bash
docker-compose logs -f api
```

### Stop Services
```bash
docker-compose down
```

### Reset Database
```bash
docker-compose exec mongodb mongosh -u root -p password admin --eval "db.dropDatabase()"
```

### Check Queue Status
```bash
docker-compose exec redis redis-cli
> LLEN bull:pipeline-analysis:0
```

## ⚠️ Troubleshooting

### API won't start
```bash
# Check logs
docker-compose logs api

# Verify MongoDB
docker-compose logs mongodb

# Verify Redis
docker-compose logs redis
```

### 401 Unauthorized
- Make sure you're including the correct API key
- Default dev key: `dev-api-key-12345`
- Check header: `X-API-Key: your-key`

### No analysis results yet
- Analysis takes 5-30 seconds depending on LLM
- Check queue: `docker-compose exec redis redis-cli LLEN bull:pipeline-analysis:0`

### LLM API errors
- Verify `OPENAI_API_KEY` in `.env`
- Check API key has sufficient balance
- Check for rate limiting

## 📞 Need Help?

- **Full Docs**: [README.md](../README.md)
- **API Reference**: [API.md](../API.md)
- **Examples**: [examples/](../examples/)
- **Security**: [SECURITY.md](../SECURITY.md)
- **Deployment**: [DEPLOYMENT.md](../DEPLOYMENT.md)

## 🎉 You're All Set!

Start using the LLM DevOps Assistant to:
- ✅ Analyze CI/CD failures
- ✅ Get root cause analysis
- ✅ Receive fix suggestions
- ✅ Auto-apply safe fixes
- ✅ Full audit trail

Happy analyzing! 🚀
