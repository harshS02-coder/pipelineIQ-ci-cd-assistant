/**
 * Prompt Templates for LLM Analysis
 */

const FAILURE_ANALYSIS_PROMPT = `You are an expert DevOps engineer analyzing CI/CD pipeline failures.

## CI/CD Failure Information:
\`\`\`
{LOGS}
\`\`\`

## Context:
- Repository: {REPOSITORY}
- Branch: {BRANCH}
- Commit: {COMMIT}
- Pipeline Type: {PROVIDER}
- Failure Type: {FAILURE_TYPE}

## Analysis Task:
Analyze this failure and provide structured insights.

## Response Format (MUST BE VALID JSON):
{
  "summary": "1-2 sentence summary",
  "rootCause": "Detailed root cause (2-3 sentences)",
  "severity": "critical|high|medium|low",
  "confidence": 0.0,
  "suggestedFixes": [
    {
      "id": "fix-001",
      "title": "Fix title",
      "description": "Detailed description",
      "severity": "critical|high|medium|low",
      "isSafe": true,
      "commands": ["cmd1", "cmd2"],
      "risks": ["risk1"],
      "benefits": ["benefit1"],
      "estimatedTime": "5 minutes"
    }
  ],
  "relatedIssues": [],
  "relatedDocumentation": []
}

IMPORTANT: Return ONLY valid JSON.`;


/**
 * Build prompt with context
 */
export const buildAnalysisPrompt = (logs, context = {}) => {
  let prompt = FAILURE_ANALYSIS_PROMPT;

  // Replace placeholders
  prompt = prompt.replace('{LOGS}', logs || 'No logs provided');
  prompt = prompt.replace('{REPOSITORY}', context.repository || 'Unknown');
  prompt = prompt.replace('{BRANCH}', context.branch || 'Unknown');
  prompt = prompt.replace('{COMMIT}', context.commit || 'Unknown');
  prompt = prompt.replace('{PROVIDER}', context.provider || 'Unknown');
  prompt = prompt.replace('{FAILURE_TYPE}', context.failureType || 'Unknown');

  return prompt;
};

/**
 * Safe Prompt for auto-fix restrictions
 */
export const buildSafeFixPrompt = (suggestion) => {
  return `Based on this failure analysis:

${JSON.stringify(suggestion, null, 2)}

Generate ONLY safe commands that:
1. Do NOT modify production data
2. Do NOT require authentication
3. Are read-only OR well-tested
4. Have reversible effects
5. Clear success/failure indicators

Return valid JSON with command list.`;
};

export default {
  FAILURE_ANALYSIS_PROMPT,
  buildAnalysisPrompt,
  buildSafeFixPrompt,
};
