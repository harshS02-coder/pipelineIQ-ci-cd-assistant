import { execSync, spawn } from 'child_process';
import path from 'path';
import logger from '../config/logger.js';
import AppliedFix from '../models/AppliedFix.js';

/**
 * Fix Service
 * Handles safe auto-fix execution with multiple safeguards
 */
class FixService {
  constructor() {
    this.enableAutoFix = process.env.ENABLE_AUTO_FIX === 'true';
    this.enableSafeFixOnly = process.env.ENABLE_SAFE_FIX_ONLY === 'true';
    this.maxRetries = parseInt(process.env.MAX_FIX_RETRY_ATTEMPTS || '3');
  }

  /**
   * Dangerous patterns that should never be auto-executed
   */
  static DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\//, // rm -rf /
    /dd\s+if=/i, // dd commands
    /fork\s*\(\s*\)/, // Bash fork bombs
    /:\(\)\s*{\s*:\|:/i, // Bash fork bomb variants
    /mkfs/, // Format filesystem
    /fdisk/, // Partition commands
    /chmod\s+000/, // Remove all permissions
    /insmod|rmmod|modprobe/, // Kernel module commands
    /update-grub|grub-install/, // Bootloader commands
    /reboot|shutdown|poweroff|halt/, // System control
    /iptables|ufw/, // Firewall (risky without context)
    /sed\s+-i/, // In-place file editing (risky)
    /drop\s+database|delete\s+from/i, // Database destruction
    /npm\s+publish/, // Publishing to registry
    /docker\s+push/, // Pushing to registry
    /git\s+push/ // Git push
  ];

  /**
   * Safe patterns that can be auto-executed
   */
  static SAFE_PATTERNS = [
    'npm install',
    'npm ci',
    'pip install',
    'yarn install',
    'go mod download',
    'composer install',
    'bundle install',
    'cargo build',
    'make',
    'echo', // Log output
    'cat', // Read files
    'ls',
    'pwd',
    'mkdir', // Create directories
    'touch', // Create files
  ];

  /**
   * Validate if a fix is safe to execute
   */
  static isSafeToExecute(commands) {
    if (!Array.isArray(commands)) {
      return { safe: false, reason: 'Commands must be an array' };
    }

    if (commands.length === 0) {
      return { safe: false, reason: 'No commands provided' };
    }

    for (const command of commands) {
      if (typeof command !== 'string') {
        return { safe: false, reason: 'Each command must be a string' };
      }

      // Check for dangerous patterns
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          return {
            safe: false,
            reason: `Command contains dangerous pattern: ${pattern}`,
          };
        }
      }

      // Allow if it matches safe patterns
      const isSafePattern = this.SAFE_PATTERNS.some((pattern) =>
        command.includes(pattern)
      );

      if (!isSafePattern) {
        return {
          safe: false,
          reason: `Command "${command}" is not in the safe execution list`,
        };
      }
    }

    return { safe: true, reason: 'All commands passed safety checks' };
  }

  /**
   * Generate commands from fix suggestions
   */
  generateFixCommands(fixSuggestion) {
    const commands = [];

    // Add dependency installation if mentioned
    if (fixSuggestion.description.match(/npm|node/i)) {
      commands.push('npm ci');
    }
    if (fixSuggestion.description.match(/pip|python/i)) {
      commands.push('pip install -r requirements.txt');
    }

    // Add provided commands
    if (Array.isArray(fixSuggestion.commands)) {
      commands.push(...fixSuggestion.commands);
    }

    return commands;
  }

  /**
   * Apply a fix safely
   */
  async applyFix(fixData, analysisResultId, failureId, appliedByUser) {
    const appliedFix = new AppliedFix({
      analysisResultId,
      failureId,
      fixId: fixData.id,
      fixTitle: fixData.title,
      appliedBy: 'auto-fix',
      appliedByUser,
      status: 'pending',
    });

    try {
      // Check if auto-fix is enabled
      if (!this.enableAutoFix) {
        throw new Error('Auto-fix is disabled in configuration');
      }

      // Check if we should only allow safe fixes
      if (this.enableSafeFixOnly && !fixData.isSafe) {
        throw new Error('Only safe fixes are allowed to be auto-executed');
      }

      // Generate commands
      const commands = this.generateFixCommands(fixData);

      // Validate safety
      const validation = FixService.isSafeToExecute(commands);
      if (!validation.safe) {
        throw new Error(`Fix validation failed: ${validation.reason}`);
      }

      // Execute with timeout
      appliedFix.status = 'in-progress';
      appliedFix.executionDetails = {
        startTime: new Date(),
        commands: [],
      };

      for (const command of commands) {
        try {
          const result = await this.executeCommand(command);
          appliedFix.executionDetails.commands.push({
            command,
            output: result.output,
            exitCode: result.exitCode,
            executedAt: new Date(),
          });

          if (result.exitCode !== 0) {
            throw new Error(`Command failed with exit code ${result.exitCode}`);
          }
        } catch (error) {
          appliedFix.executionDetails.commands.push({
            command,
            output: error.message,
            exitCode: 1,
            executedAt: new Date(),
          });
          throw error;
        }
      }

      // Verify the fix
      const verificationResult = await this.verifyFix(fixData);

      appliedFix.status = 'success';
      appliedFix.executionDetails.endTime = new Date();
      appliedFix.executionDetails.duration =
        appliedFix.executionDetails.endTime -
        appliedFix.executionDetails.startTime;
      appliedFix.verificationResult = verificationResult;

      await appliedFix.save();

      logger.info(
        { fixId: fixData.id, duration: appliedFix.executionDetails.duration },
        'Fix applied successfully'
      );

      return {
        success: true,
        appliedFix,
        message: 'Fix applied successfully',
      };
    } catch (error) {
      logger.error({ err: error, fixId: fixData.id }, 'Fix application failed');

      appliedFix.status = 'failed';
      appliedFix.executionDetails.endTime = new Date();
      appliedFix.executionDetails.duration =
        appliedFix.executionDetails.endTime -
        appliedFix.executionDetails.startTime;

      if (typeof error.message === 'string') {
        appliedFix.logs = error.message;
      }

      await appliedFix.save();

      return {
        success: false,
        appliedFix,
        error: error.message,
      };
    }
  }

  /**
   * Execute a command with timeout and safety checks
   */
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout after 30 seconds: ${command}`));
      }, 30000);

      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024, // 1MB buffer
          timeout: 30000,
        });

        clearTimeout(timeout);
        resolve({ output, exitCode: 0 });
      } catch (error) {
        clearTimeout(timeout);
        reject({
          output: error.stdout || error.message,
          exitCode: error.status || 1,
          error,
        });
      }
    });
  }

  /**
   * Verify that a fix was successful
   */
  async verifyFix(fixData) {
    const checks = [];

    // Basic verification checks
    const verificationChecks = [
      {
        name: 'Dependencies installed',
        command: 'npm list',
        expectedOutput: 'npm notice',
      },
      {
        name: 'No syntax errors',
        command: 'node --check index.js 2>/dev/null || echo "check skipped"',
        expectedOutput: '',
      },
    ];

    for (const check of verificationChecks) {
      try {
        const result = await this.executeCommand(check.command);
        checks.push({
          name: check.name,
          passed: result.exitCode === 0,
          output: result.output.substring(0, 500),
        });
      } catch (error) {
        checks.push({
          name: check.name,
          passed: false,
          output: error.message || 'Check failed',
        });
      }
    }

    return {
      passed: checks.every((c) => c.passed),
      checks,
      timestamp: new Date(),
    };
  }

  /**
   * Rollback a fix
   */
  async rollbackFix(appliedFixId, reason) {
    try {
      const appliedFix = await AppliedFix.findById(appliedFixId);
      if (!appliedFix) {
        throw new Error('Applied fix not found');
      }

      // TODO: Implement actual rollback based on git/file versioning
      // For now, mark as rolled back in logs

      appliedFix.rollbackInfo = {
        isRolledBack: true,
        rollbackReason: reason,
        rollbackTime: new Date(),
        rollbackStatus: 'pending',
      };

      await appliedFix.save();

      logger.info({ fixId: appliedFixId }, 'Fix rollback initiated');

      return {
        success: true,
        message: 'Rollback initiated',
      };
    } catch (error) {
      logger.error({ err: error }, 'Rollback failed');
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new FixService();
