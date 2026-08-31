# API Reference

## Base URL
```
/api/v1/analyze
```

## Authentication

All endpoints require authentication via one of:
- `X-API-Key` header
- `Authorization: Bearer <token>` header

## Response Format

All responses follow this format:

```json
{
  "success": true|false,
  "data": {},
  "error": "error message if failed",
  "requestId": "unique-request-id"
}
```

---

## Endpoints

### Health Check
**GET** `/health`

No authentication required. Returns server health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-27T10:30:00Z",
  "uptime": 3600
}
```

---

### Submit Failure
**POST** `/submit`

Submit a pipeline failure for analysis.

**Required Body:**
```json
{
  "logs": "string, max 10MB",
  "pipelineId": "string, required",
  "pipelineName": "string, optional",
  "cicdProvider": "github-actions|jenkins|gitlab-ci|other"
}
```

**Optional Body:**
```json
{
  "commitSha": "string",
  "commitAuthor": "string",
  "repositoryUrl": "string",
  "branch": "string",
  "failureType": "build|test|deployment|security-scan|lint|unknown"
}
```

**Response:**
```json
{
  "success": true,
  "failureId": "507f1f77bcf86cd799439011",
  "jobId": "abc-123",
  "message": "Failure submitted for analysis",
  "status": "queued"
}
```

**Status Codes:**
- `202` - Accepted, queued for processing
- `400` - Missing required fields
- `401` - Unauthorized
- `500` - Server error

---

### Webhook Handler
**POST** `/webhook`

Receive webhooks from CI/CD providers. Automatically detects provider and validates signatures.

**GitHub Actions:**
- Header: `X-GitHub-Event: workflow_run`
- Header: `X-Hub-Signature-256: sha256=...`
- Body: GitHub workflow webhook payload

**Jenkins:**
- Header: `X-Jenkins: version`
- Body: JSON payload with build info

**GitLab:**
- Header: `X-Gitlab-Event: Pipeline Hook`
- Body: GitLab pipeline payload

**Response:**
```json
{
  "success": true,
  "failureId": "507f1f77bcf86cd799439011",
  "jobId": "abc-123",
  "message": "Webhook received and queued"
}
```

---

### Get Analysis
**GET** `/analysis/{analysisId}`

Retrieve analysis results for a processed failure.

**Parameters:**
- `analysisId` (path): MongoDB ObjectId

**Response:**
```json
{
  "success": true,
  "analysis": {
    "_id": "507f1f77bcf86cd799439012",
    "failureId": "507f1f77bcf86cd799439011",
    "summary": "Module not found error occurred during build",
    "rootCause": "Required npm dependencies were not installed",
    "confidence": 0.92,
    "status": "completed",
    "suggestedFixes": [
      {
        "id": "fix-001",
        "title": "Install Dependencies",
        "description": "Run npm ci to install dependencies from lock file",
        "severity": "high",
        "isSafe": true,
        "safetyReason": "Safe package installation using lock file",
        "commands": ["npm ci"],
        "risks": [],
        "benefits": ["Resolves missing module error"],
        "estimatedTime": "5 minutes"
      }
    ],
    "relatedIssues": [],
    "relatedDocumentation": [],
    "analysisDetails": {
      "llmModel": "gpt-4-turbo",
      "llmProvider": "openai",
      "analysisTime": 3456,
      "tokensUsed": {
        "input": 1023,
        "output": 456
      },
      "temperature": 0.7
    },
    "createdAt": "2024-03-27T10:25:00Z",
    "completedAt": "2024-03-27T10:25:03Z"
  }
}
```

---

### List Failures
**GET** `/failures`

Get paginated list of pipeline failures.

**Query Parameters:**
- `limit` (optional): Results per page, default 20, max 100
- `offset` (optional): Pagination offset, default 0
- `status` (optional): pending-analysis|analyzing|analyzed|failed
- `provider` (optional): github-actions|jenkins|gitlab-ci|other

**Example:**
```
GET /failures?status=analyzed&limit=50&offset=0
```

**Response:**
```json
{
  "success": true,
  "failures": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "pipelineId": "workflow-123",
      "pipelineName": "Build Pipeline",
      "cicdProvider": "github-actions",
      "commitSha": "abc123...",
      "branch": "main",
      "status": "analyzed",
      "createdAt": "2024-03-27T10:20:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

---

### Get Failure Details
**GET** `/failures/{failureId}`

Get full details of a failure including analysis and applied fixes.

**Parameters:**
- `failureId` (path): MongoDB ObjectId

**Response:**
```json
{
  "success": true,
  "failure": {
    "_id": "507f1f77bcf86cd799439011",
    "pipelineId": "workflow-123",
    "logs": {
      "raw": "npm ERR! code ENOENT...",
      "truncated": false,
      "size": 4567
    },
    "status": "analyzed",
    "createdAt": "2024-03-27T10:20:00Z"
  },
  "analysis": {
    "_id": "507f1f77bcf86cd799439012",
    "summary": "...",
    "rootCause": "...",
    "suggestedFixes": []
  },
  "appliedFixes": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "fixId": "fix-001",
      "status": "success",
      "appliedBy": "auto-fix",
      "createdAt": "2024-03-27T10:25:00Z",
      "completedAt": "2024-03-27T10:26:00Z"
    }
  ]
}
```

---

### Apply Fix
**POST** `/fix/apply`

Manually trigger a fix application.

**Required Body:**
```json
{
  "analysisId": "507f1f77bcf86cd799439012",
  "fixId": "fix-001",
  "appliedByUser": "developer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "fix-job-456",
  "message": "Fix application queued",
  "status": "queued"
}
```

---

### Get Applied Fixes
**GET** `/failures/{failureId}/fixes`

Get all fixes applied to a failure.

**Parameters:**
- `failureId` (path): MongoDB ObjectId

**Response:**
```json
{
  "success": true,
  "fixes": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "fixId": "fix-001",
      "fixTitle": "Install Dependencies",
      "status": "success",
      "appliedBy": "auto-fix",
      "appliedByUser": "system",
      "executionDetails": {
        "startTime": "2024-03-27T10:25:00Z",
        "endTime": "2024-03-27T10:26:00Z",
        "duration": 60000,
        "commands": [
          {
            "command": "npm ci",
            "output": "added 150 packages...",
            "exitCode": 0,
            "executedAt": "2024-03-27T10:25:30Z"
          }
        ]
      },
      "verificationResult": {
        "passed": true,
        "checks": [
          {
            "name": "Dependencies installed",
            "passed": true,
            "output": "npm notice"
          }
        ]
      },
      "createdAt": "2024-03-27T10:25:00Z"
    }
  ]
}
```

---

### Get Statistics
**GET** `/stats`

Get system-wide statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalFailures": 1234,
    "analyzedFailures": 1150,
    "analysisRate": "93.18%",
    "successfulFixes": 680,
    "failedFixes": 45,
    "successRate": "93.79%"
  }
}
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "error": "Validation failed",
  "details": {
    "logs": "Field is required",
    "pipelineId": "Field must be a string"
  }
}
```

### 401 - Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid X-API-Key header"
}
```

### 404 - Not Found
```json
{
  "error": "Analysis not found"
}
```

### 429 - Rate Limited
```json
{
  "error": "Too many requests",
  "retryAfter": 60
}
```

### 500 - Server Error
```json
{
  "error": "Failed to submit failure",
  "details": "Internal server error message",
  "requestId": "req-123-456"
}
```

---

## Rate Limits

- **Default**: 100 requests per 15 minutes per API key
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Request/Response Headers

### Request Headers
```
X-API-Key: your-api-key
Authorization: Bearer <token>
X-Request-ID: optional-tracking-id
Content-Type: application/json
```

### Response Headers
```
X-Request-ID: unique-request-id
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1711517400
```

---

## SDK/Client Examples

### cURL
```bash
curl -X POST http://localhost:3000/api/v1/analyze/submit \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"logs": "...", "pipelineId": "123"}'
```

### Python
```python
import requests

response = requests.post(
  'http://localhost:3000/api/v1/analyze/submit',
  json={
    'logs': '...',
    'pipelineId': '123',
    'pipelineName': 'Build Pipeline'
  },
  headers={
    'X-API-Key': 'your-api-key'
  }
)

print(response.json())
```

### JavaScript/Node.js
```javascript
const axios = require('axios');

axios.post(
  'http://localhost:3000/api/v1/analyze/submit',
  {
    logs: '...',
    pipelineId: '123',
    pipelineName: 'Build Pipeline'
  },
  {
    headers: {
      'X-API-Key': 'your-api-key'
    }
  }
).then(res => console.log(res.data));
```

### Go
```go
package main

import (
  "bytes"
  "encoding/json"
  "net/http"
)

type FailureRequest struct {
  Logs       string `json:"logs"`
  PipelineID string `json:"pipelineId"`
}

req, _ := http.NewRequest("POST", 
  "http://localhost:3000/api/v1/analyze/submit",
  bytes.NewReader(jsonData))
req.Header.Set("X-API-Key", "your-api-key")
req.Header.Set("Content-Type", "application/json")
```

---

## Webhooks

### GitHub Actions
```
POST /api/v1/analyze/webhook
X-GitHub-Event: workflow_run
X-Hub-Signature-256: sha256=abc123...
X-GitHub-Delivery: 12345-67890
```

### Webhook Event Flow
1. **Failed Pipeline**  
   ↓
2. **Webhook Sent to API**  
   ↓
3. **Signature Validated**  
   ↓
4. **Failure Recorded**  
   ↓
5. **Analysis Queued**  
   ↓
6. **Results Available** (check `/analysis/{id}`)
