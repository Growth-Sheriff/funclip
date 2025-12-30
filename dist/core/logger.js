"use strict";
/**
 * FuncLib v4 - Structured Logging System
 *
 * Console.log yerine kullanılacak structured logger.
 * Log levels, formatlar, renk desteği.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
exports.getLogger = getLogger;
exports.createLogger = createLogger;
const fs_1 = require("fs");
const path_1 = require("path");
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
const LEVEL_COLORS = {
    debug: COLORS.gray,
    info: COLORS.blue,
    warn: COLORS.yellow,
    error: COLORS.red,
    silent: '',
};
const LEVEL_ICONS = {
    debug: '🔍',
    info: '📋',
    warn: '⚠️',
    error: '❌',
    silent: '',
};
const LEVEL_PRIORITY = {
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
    config;
    logBuffer = [];
    flushInterval = null;
    constructor(config = {}) {
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
    shouldLog(level) {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.config.level];
    }
    /**
     * Format timestamp
     */
    formatTimestamp() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 19);
    }
    /**
     * Format log entry as text
     */
    formatText(entry) {
        const parts = [];
        // Timestamp
        if (this.config.timestamps) {
            if (this.config.colors) {
                parts.push(`${COLORS.gray}[${this.formatTimestamp()}]${COLORS.reset}`);
            }
            else {
                parts.push(`[${this.formatTimestamp()}]`);
            }
        }
        // Level
        const levelStr = entry.level.toUpperCase().padEnd(5);
        if (this.config.colors) {
            parts.push(`${LEVEL_COLORS[entry.level]}${LEVEL_ICONS[entry.level]} ${levelStr}${COLORS.reset}`);
        }
        else {
            parts.push(`${LEVEL_ICONS[entry.level]} ${levelStr}`);
        }
        // Prefix
        if (this.config.prefix) {
            if (this.config.colors) {
                parts.push(`${COLORS.cyan}[${this.config.prefix}]${COLORS.reset}`);
            }
            else {
                parts.push(`[${this.config.prefix}]`);
            }
        }
        // Source
        if (entry.source) {
            if (this.config.colors) {
                parts.push(`${COLORS.magenta}[${entry.source}]${COLORS.reset}`);
            }
            else {
                parts.push(`[${entry.source}]`);
            }
        }
        // Message
        parts.push(entry.message);
        // Context
        if (entry.context && Object.keys(entry.context).length > 0) {
            if (this.config.colors) {
                parts.push(`${COLORS.dim}${JSON.stringify(entry.context)}${COLORS.reset}`);
            }
            else {
                parts.push(JSON.stringify(entry.context));
            }
        }
        return parts.join(' ');
    }
    /**
     * Format log entry as JSON
     */
    formatJson(entry) {
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
    write(entry) {
        if (!this.shouldLog(entry.level)) {
            return;
        }
        const formatted = this.config.format === 'json'
            ? this.formatJson(entry)
            : this.formatText(entry);
        // Write to console
        if (entry.level === 'error') {
            console.error(formatted);
        }
        else if (entry.level === 'warn') {
            console.warn(formatted);
        }
        else {
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
    flush() {
        if (!this.config.file || this.logBuffer.length === 0) {
            return;
        }
        const dir = (0, path_1.dirname)(this.config.file);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        const lines = this.logBuffer.map(entry => this.config.format === 'json' ? this.formatJson(entry) : this.formatText(entry)).join('\n') + '\n';
        (0, fs_1.appendFileSync)(this.config.file, lines, 'utf-8');
        this.logBuffer = [];
    }
    /**
     * Log debug message
     */
    debug(message, context, source) {
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
    info(message, context, source) {
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
    warn(message, context, source) {
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
    error(message, context, source) {
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
    child(prefix) {
        return new Logger({
            ...this.config,
            prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
        });
    }
    /**
     * Update configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get current level
     */
    getLevel() {
        return this.config.level;
    }
    /**
     * Set log level
     */
    setLevel(level) {
        this.config.level = level;
    }
    /**
     * Cleanup
     */
    dispose() {
        this.flush();
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }
}
exports.Logger = Logger;
// ========================
// Singleton Instance
// ========================
let loggerInstance = null;
function getLogger() {
    if (!loggerInstance) {
        loggerInstance = new Logger();
    }
    return loggerInstance;
}
function createLogger(config) {
    return new Logger(config);
}
//# sourceMappingURL=logger.js.map