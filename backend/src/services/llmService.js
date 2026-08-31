import axios from 'axios';
import logger from '../config/logger.js';

/**
 * LLM Service
 * Handles interactions with different LLM providers
 */
class LLMService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'openai';
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
  }

  /**
   * Analyze CI/CD failure logs
   * @param {string} logs - Truncated logs
   * @param {object} context - Additional context
   * @returns {object} Analysis result
   */
  async analyzeFailure(logs, context = {}) {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(logs, context);

      let response;
      switch (this.provider) {
        case 'openai':
          response = await this.callOpenAI(prompt);
          break;
        case 'anthropic':
          response = await this.callAnthropic(prompt);
          break;
        case 'gemini':
          response = await this.callGemini(prompt);
          break;
        case 'ollama':
          response = await this.callOllama(prompt);
          break;
        case 'grok':
          response = await this.callGrok(prompt);
          break;
        default:
          throw new Error(`Unknown LLM provider: ${this.provider}`);
      }

      const analysisTime = Date.now() - startTime;

      // Parse the response
      const analysis = this.parseResponse(response);

      return {
        success: true,
        analysis,
        metadata: {
          provider: this.provider,
          model: this.getModel(),
          analysisTime,
          tokensUsed: response.tokensUsed || null,
        },
      };
    } catch (error) {
      logger.error({ err: error, provider: this.provider }, 'LLM analysis failed');
      return {
        success: false,
        error: error.message,
        analysis: null,
      };
    }
  }

  /**
   * Build the prompt for LLM analysis
   */
  buildPrompt(logs, context) {
    return `You are an expert DevOps engineer analyzing CI/CD pipeline failures.

## CI/CD Failure Logs:
\`\`\`
${logs}
\`\`\`

## Pipeline Context:
- Repository: ${context.repositoryUrl || 'Unknown'}
- Branch: ${context.branch || 'Unknown'}
- Commit: ${context.commitSha?.substring(0, 8) || 'Unknown'}
- Provider: ${context.provider || 'Unknown'}

## Your Task:
Analyze the failure and provide:

1. **Summary** (1-2 sentences): Brief overview of what failed
2. **Root Cause** (2-3 sentences): Why the failure occurred
3. **Severity**: critical/high/medium/low
4. **Suggested Fixes**: JSON array of at least 2 fixes, each with:
   - id: unique identifier
   - title: short title
   - description: detailed description
   - severity: critical/high/medium/low
   - isSafe: boolean (true only for read-only or well-tested changes)
   - commands: array of shell commands to fix
   - risks: array of potential risks
   - benefits: array of benefits
   - estimatedTime: estimated fix time

5. **Related Issues**: Common related issues or documentation links
6. **Confidence**: 0-1 confidence score in your analysis

## Response Format (JSON):
{
  "summary": "...",
  "rootCause": "...",
  "severity": "...",
  "confidence": 0.85,
  "suggestedFixes": [
    {
      "id": "fix-001",
      "title": "...",
      "description": "...",
      "severity": "...",
      "isSafe": true,
      "commands": ["command1", "command2"],
      "risks": ["..."],
      "benefits": ["..."],
      "estimatedTime": "5 minutes"
    }
  ],
  "relatedIssues": ["..."],
  "relatedDocumentation": ["..."]
}

IMPORTANT: Return ONLY valid JSON, no markdown or additional text.`;
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4-turbo';

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert DevOps engineer analyzing CI/CD pipeline failures. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.temperature,
        max_tokens: 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0].message.content;

    return {
      content,
      tokensUsed: {
        input: response.data.usage.prompt_tokens,
        output: response.data.usage.completion_tokens,
      },
    };
  }

  /**
   * Call xAI Grok API
   */
  async callGrok(prompt) {
    const apiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert DevOps engineer analyzing CI/CD pipeline failures. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.temperature,
        max_tokens: 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0].message.content;

    return {
      content,
      tokensUsed: {
        input: response.data.usage?.prompt_tokens || null,
        output: response.data.usage?.completion_tokens || null,
      },
    };
  }

  /**
   * Call Anthropic Claude API
   */
  async callAnthropic(prompt) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.content[0].text;

    return {
      content,
      tokensUsed: {
        input: response.data.usage.input_tokens,
        output: response.data.usage.output_tokens,
      },
    };
  }

  /**
   * Call Google Gemini API
   */
  async callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: 2000,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;

    return {
      content,
      tokensUsed: {
        input: response.data.usageMetadata?.promptTokenCount || null,
        output: response.data.usageMetadata?.candidatesTokenCount || null,
      },
    };
  }

  /**
   * Call local Ollama instance
   */
  async callOllama(prompt) {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama2';

    const response = await axios.post(
      `${baseUrl}/api/generate`,
      {
        model,
        prompt,
        stream: false,
        temperature: this.temperature,
      },
      {
        timeout: 120000, // Local models can be slow
      }
    );

    return {
      content: response.data.response,
      tokensUsed: null,
    };
  }

  /**
   * Parse LLM response
   */
  parseResponse(response) {
    const content = response.content.trim();

    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    const required = ['summary', 'rootCause', 'suggestedFixes'];
    for (const field of required) {
      if (!parsed[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Ensure suggestedFixes is an array
    if (!Array.isArray(parsed.suggestedFixes)) {
      parsed.suggestedFixes = [parsed.suggestedFixes];
    }

    // Validate each fix
    parsed.suggestedFixes = parsed.suggestedFixes.map((fix) => ({
      id: fix.id || `fix-${Date.now()}`,
      title: fix.title || 'Untitled',
      description: fix.description || '',
      severity: fix.severity || 'medium',
      isSafe: Boolean(fix.isSafe),
      safetyReason: fix.safetyReason || '',
      commands: Array.isArray(fix.commands) ? fix.commands : [],
      fileChanges: fix.fileChanges || [],
      risks: Array.isArray(fix.risks) ? fix.risks : [],
      benefits: Array.isArray(fix.benefits) ? fix.benefits : [],
      estimatedTime: fix.estimatedTime || 'Unknown',
    }));

    return {
      summary: parsed.summary,
      rootCause: parsed.rootCause,
      severity: parsed.severity || 'medium',
      confidence: parsed.confidence || 0.5,
      suggestedFixes: parsed.suggestedFixes,
      relatedIssues: parsed.relatedIssues || [],
      relatedDocumentation: parsed.relatedDocumentation || [],
    };
  }

  /**
   * Get the active model name
   */
  getModel() {
    switch (this.provider) {
      case 'openai':
        return process.env.OPENAI_MODEL || 'gpt-4-turbo';
      case 'anthropic':
        return 'claude-3-opus-20240229';
      case 'gemini':
        return process.env.GEMINI_MODEL || 'gemini-1.5-pro';
      case 'ollama':
        return process.env.OLLAMA_MODEL || 'llama2';
      case 'grok':
        return process.env.GROK_MODEL || 'grok-2';
      default:
        return 'unknown';
    }
  }
}

export default new LLMService();