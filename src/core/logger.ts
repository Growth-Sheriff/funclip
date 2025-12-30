/**
 * FuncLib v4 - Structured Logging System
 * 
 * Console.log yerine kullanılacak structured logger.
 * Log levels, formatlar, renk desteği.
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ========================
// Log Types
// ========================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  source?: string;
}

interface LoggerConfig {
  level: LogLevel;
  format: 'text' | 'json';
  timestamps: boolean;
  colors: boolean;
  file?: string;
  prefix?: string;
}

// ========================
// Color Codes
// ========================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.gray,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
  silent: '',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  debug: '🔍',
  info: '📋',
  warn: '⚠️',
  error: '❌',
  silent: '',
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// ========================
// Logger Class
// ========================

class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? 'info',
      format: config.format ?? 'text',
      timestamps: config.timestamps ?? true,
      colors: config.colors ?? true,
      file: config.file,
      prefix: config.prefix,
    };

    // Auto-flush to file every 5 seconds if file logging enabled
    if (this.config.file) {
      this.flushInterval = setInterval(() => this.flush(), 5000);
    }
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * Format log entry as text
   */
  private formatText(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.config.timestamps) {
      if (this.config.colors) {
        parts.push(`${COLORS.gray}[${this.formatTimestamp()}]${COLORS.reset}`);
      } else {
        parts.push(`[${this.formatTimestamp()}]`);
      }
    }

    // Level
    const levelStr = entry.level.toUpperCase().padEnd(5);
    if (this.config.colors) {
      parts.push(`${LEVEL_COLORS[entry.level]}${LEVEL_ICONS[entry.level]} ${levelStr}${COLORS.reset}`);
    } else {
      parts.push(`${LEVEL_ICONS[entry.level]} ${levelStr}`);
    }

    // Prefix
    if (this.config.prefix) {
      if (this.config.colors) {
        parts.push(`${COLORS.cyan}[${this.config.prefix}]${COLORS.reset}`);
      } else {
        parts.push(`[${this.config.prefix}]`);
      }
    }

    // Source
    if (entry.source) {
      if (this.config.colors) {
        parts.push(`${COLORS.magenta}[${entry.source}]${COLORS.reset}`);
      } else {
        parts.push(`[${entry.source}]`);
      }
    }

    // Message
    parts.push(entry.message);

    // Context
    if (entry.context && Object.keys(entry.context).length > 0) {
      if (this.config.colors) {
        parts.push(`${COLORS.dim}${JSON.stringify(entry.context)}${COLORS.reset}`);
      } else {
        parts.push(JSON.stringify(entry.context));
      }
    }

    return parts.join(' ');
  }

  /**
   * Format log entry as JSON
   */
  private formatJson(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      source: entry.source,
      ...entry.context,
    });
  }

  /**
   * Write log entry
   */
  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formatted = this.config.format === 'json'
      ? this.formatJson(entry)
      : this.formatText(entry);

    // Write to console
    if (entry.level === 'error') {
      console.error(formatted);
    } else if (entry.level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // Buffer for file
    if (this.config.file) {
      this.logBuffer.push(entry);
    }
  }

  /**
   * Flush buffer to file
   */
  flush(): void {
    if (!this.config.file || this.logBuffer.length === 0) {
      return;
    }

    const dir = dirname(this.config.file);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const lines = this.logBuffer.map(entry => 
      this.config.format === 'json' ? this.formatJson(entry) : this.formatText(entry)
    ).join('\n') + '\n';

    appendFileSync(this.config.file, lines, 'utf-8');
    this.logBuffer = [];
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>, source?: string): void {
    this.write({
      level: 'debug',
      message,
      timestamp: new Date(),
      context,
      source,
    });
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>, source?: string): void {
    this.write({
      level: 'info',
      message,
      timestamp: new Date(),
      context,
      source,
    });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>, source?: string): void {
    this.write({
      level: 'warn',
      message,
      timestamp: new Date(),
      context,
      source,
    });
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, any>, source?: string): void {
    this.write({
      level: 'error',
      message,
      timestamp: new Date(),
      context,
      source,
    });
  }

  /**
   * Create child logger with prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

// ========================
// Singleton Instance
// ========================

let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

export function createLogger(config: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}

export { Logger, LoggerConfig };
