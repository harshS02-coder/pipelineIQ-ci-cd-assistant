#!/bin/bash

# LLM DevOps Assistant - cURL Examples
# Usage: bash examples/curl-examples.sh

API_URL="http://localhost:3000/api/v1/analyze"
API_KEY="dev-api-key-12345"

echo "🧪 LLM DevOps Assistant - cURL Examples"
echo "========================================"
echo ""
echo "API URL: $API_URL"
echo "API Key: $API_KEY"
echo ""

# ============================================
# 1. Health Check (No Auth Required)
# ============================================
echo "1️⃣ Health Check"
echo "───────────────"
curl -s "$API_URL/health" | jq .
echo ""

# ============================================
# 2. Submit a Failure
# ============================================
echo "2️⃣ Submit Failure for Analysis"
echo "──────────────────────────────"

FAILURE_JSON=$(cat <<'EOF'
{
  "logs": "npm ERR! code ENOENT\nnpm ERR! syscall open\nnpm ERR! path /app/package.json\nnpm ERR! errno -2\nnpm ERR! enoent ENOENT: no such file or directory, open '/app/package.json'",
  "pipelineId": "github-run-12345",
  "pipelineName": "Build & Deploy Pipeline",
  "cicdProvider": "github-actions",
  "commitSha": "a1b2c3d4e5f6g7h8i9j0",
  "commitAuthor": "developer@example.com",
  "repositoryUrl": "https://github.com/myorg/myrepo",
  "branch": "main",
  "failureType": "build"
}
EOF
)

SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$FAILURE_JSON")

echo "$SUBMIT_RESPONSE" | jq .
FAILURE_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.failureId')
ANALYSIS_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.requestId')

echo "Failure ID: $FAILURE_ID"
echo ""

# ============================================
# 3. Get Failure Details (wait a moment)
# ============================================
echo "3️⃣ Get Failure Details"
echo "─────────────────────"
sleep 3

curl -s "$API_URL/failures/$FAILURE_ID" \
  -H "X-API-Key: $API_KEY" | jq .
echo ""

# ============================================
# 4. List Recent Failures
# ============================================
echo "4️⃣ List Recent Failures"
echo "─────────────────────"

curl -s "$API_URL/failures?limit=5&status=analyzed" \
  -H "X-API-Key: $API_KEY" | jq .
echo ""

# ============================================
# 5. Get Statistics
# ============================================
echo "5️⃣ Get System Statistics"
echo "───────────────────────"

curl -s "$API_URL/stats" \
  -H "X-API-Key: $API_KEY" | jq .
echo ""

# ============================================
# 6. Test Rate Limiting Headers
# ============================================
echo "6️⃣ Test Rate Limiting"
echo "────────────────────"

HEADERS=$(curl -s -i "$API_URL/health" 2>&1)
echo "$HEADERS" | grep "X-RateLimit"
echo ""

# ============================================
# 7. Test Authentication (should fail)
# ============================================
echo "7️⃣ Test Without Authentication (Should Fail)"
echo "──────────────────────────────────────────"

curl -s "$API_URL/failures" | jq .
echo ""

# ============================================
# 8. Manual Webhook Test (GitHub Actions)
# ============================================
echo "8️⃣ Webhook Simulation (GitHub Actions)"
echo "─────────────────────────────────────"

WEBHOOK_PAYLOAD=$(cat <<'EOF'
{
  "action": "completed",
  "workflow_run": {
    "id": 98765432,
    "name": "CI Pipeline",
    "conclusion": "failure",
    "head_branch": "feature/bug-fix",
    "head_commit": {
      "id": "abc123def456",
      "message": "Add new feature",
      "author": {
        "name": "John Developer"
      }
    }
  },
  "repository": {
    "name": "myrepo",
    "full_name": "myorg/myrepo",
    "html_url": "https://github.com/myorg/myrepo"
  }
}
EOF
)

curl -s -X POST "$API_URL/webhook" \
  -H "X-GitHub-Event: workflow_run" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_PAYLOAD" | jq .
echo ""

echo "✅ Examples completed!"
echo ""
echo "📚 More examples available in:"
echo "   - examples/submit-failure.sh"
echo "   - examples/test-local.sh"
echo "   - examples/github-actions-workflow.yml"
echo "   - API.md documentation"
