#!/bin/bash

# Submit CI/CD Failure to LLM Assistant
# Usage: ./submit-failure.sh <log-file> [pipeline-id] [pipeline-name]

set -e

# Configuration
API_URL="${LLM_API_URL:-http://localhost:3000/api/v1/analyze}"
API_KEY="${LLM_API_KEY:-dev-api-key-12345}"
LOG_FILE="${1:-.}"
PIPELINE_ID="${2:-unknown}"
PIPELINE_NAME="${3:-Manual Submission}"
CI_PROVIDER="${CI_PROVIDER:-unknown}"
BRANCH="${GIT_BRANCH:-main}"
COMMIT="${GIT_COMMIT:-unknown}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📤 Submitting CI/CD Failure for Analysis${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Validate log file
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}❌ Error: Log file not found: $LOG_FILE${NC}"
    exit 1
fi

# Read logs
LOGS=$(cat "$LOG_FILE")

# Sanitize sensitive data
LOGS=$(echo "$LOGS" | sed -E 's/(password|secret|token|api[_-]?key)=\S+/\1=***REDACTED***/g')

echo -e "${GREEN}✓${NC} Log file read ($(wc -c < "$LOG_FILE") bytes)"

# Create payload
PAYLOAD=$(cat <<EOF
{
    "logs": $(echo "$LOGS" | jq -Rs .),
    "pipelineId": "$PIPELINE_ID",
    "pipelineName": "$PIPELINE_NAME",
    "cicdProvider": "$CI_PROVIDER",
    "branch": "$BRANCH",
    "commitSha": "$COMMIT"
}
EOF
)

echo -e "${GREEN}✓${NC} Payload prepared"

# Submit to API
echo -e "${YELLOW}Submitting to: $API_URL${NC}"

RESPONSE=$(curl -s -X POST "$API_URL/submit" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

echo "$RESPONSE" | jq .

# Check response
if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    FAILURE_ID=$(echo "$RESPONSE" | jq -r '.failureId')
    JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId')
    
    echo ""
    echo -e "${GREEN}✅ Success!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "Failure ID: ${GREEN}$FAILURE_ID${NC}"
    echo -e "Job ID: ${GREEN}$JOB_ID${NC}"
    echo "Status: Queued for analysis"
    echo ""
    echo -e "📊 View results:"
    echo "   $API_URL/failures/$FAILURE_ID"
    echo ""
else
    echo -e "${RED}❌ Error submitting failure${NC}"
    exit 1
fi
