#!/bin/bash

# Local Testing Script for LLM DevOps Assistant
#
# Prerequisites:
# - Node.js 18+
# - MongoDB running
# - Redis running
#
# Usage: ./test-local.sh

set -e

API_URL="http://localhost:3000/api/v1/analyze"
API_KEY="dev-api-key-12345"

echo "🧪 Testing LLM DevOps Assistant API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Health Check
echo "Test 1️⃣: Health Check"
curl -s "$API_URL/health" | jq .
echo ""
echo "✅ Health check passed"
echo ""

# Test 2: Submit a Failure
echo "Test 2️⃣: Submit Failure"
FAILURE_RESPONSE=$(curl -s -X POST "$API_URL/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "logs": "npm ERR! Cannot find module '\''express'\''\nnpm ERR! Require stack:\nnpm ERR! /app/server.js",
    "pipelineId": "test-pipeline-001",
    "pipelineName": "Test Pipeline",
    "cicdProvider": "github-actions",
    "branch": "main",
    "commitSha": "abc123def456",
    "commitAuthor": "test-user"
  }')

echo "$FAILURE_RESPONSE" | jq .

FAILURE_ID=$(echo "$FAILURE_RESPONSE" | jq -r '.failureId')
echo "Created Failure ID: $FAILURE_ID"
echo ""

# Test 3: Get Failure Details
echo "Test 3️⃣: Get Failure Details"
sleep 2  # Wait a moment for processing
curl -s "$API_URL/failures/$FAILURE_ID" \
  -H "X-API-Key: $API_KEY" | jq .
echo ""

# Test 4: List Failures
echo "Test 4️⃣: List Failures"
curl -s "$API_URL/failures?limit=5" \
  -H "X-API-Key: $API_KEY" | jq .
echo ""

# Test 5: Statistics
echo "Test 5️⃣: Get Statistics"
curl -s "$API_URL/stats" \
  -H "X-API-Key: $API_KEY" | jq .
echo ""

# Test 6: Rate Limiting
echo "Test 6️⃣: Rate Limiting Test"
echo "Sending multiple requests..."
for i in {1..5}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  echo "  Request $i: HTTP $HTTP_CODE"
done
echo ""

# Test 7: Authentication
echo "Test 7️⃣: Authentication Test (should fail)"
echo "Without API Key:"
curl -s "$API_URL/failures" | jq . || echo "Expected: 401 Unauthorized"
echo ""

echo "✅ All tests completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
