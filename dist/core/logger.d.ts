/**
 * FuncLib v4 - Structured Logging System
 *
 * Console.log yerine kullanılacak structured logger.
 * Log levels, formatlar, renk desteği.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
interface LoggerConfig {
    level: LogLevel;
    format: 'text' | 'json';
    timestamps: boolean;
    colors: boolean;
    file?: string;
    prefix?: string;
}
declare class Logger {
    private config;
    private logBuffer;
    private flushInterval;
    constructor(config?: Partial<LoggerConfig>);
    /**
     * Check if level should be logged
     */
    private shouldLog;
    /**
     * Format timestamp
     */
    private formatTimestamp;
    /**
     * Format log entry as text
     */
    private formatText;
    /**
     * Format log entry as JSON
     */
    private formatJson;
    /**
     * Write log entry
     */
    private write;
    /**
     * Flush buffer to file
     */
    flush(): void;
    /**
     * Log debug message
     */
    debug(message: string, context?: Record<string, any>, source?: string): void;
    /**
     * Log info message
     */
    info(message: string, context?: Record<string, any>, source?: string): void;
    /**
     * Log warning message
     */
    warn(message: string, context?: Record<string, any>, source?: string): void;
    /**
     * Log error message
     */
    error(message: string, context?: Record<string, any>, source?: string): void;
    /**
     * Create child logger with prefix
     */
    child(prefix: string): Logger;
    /**
     * Update configuration
     */
    setConfig(config: Partial<LoggerConfig>): void;
    /**
     * Get current level
     */
    getLevel(): LogLevel;
    /**
     * Set log level
     */
    setLevel(level: LogLevel): void;
    /**
     * Cleanup
     */
    dispose(): void;
}
export declare function getLogger(): Logger;
export declare function createLogger(config: Partial<LoggerConfig>): Logger;
export { Logger, LoggerConfig };
