"use strict";
/**
 * FuncLib v4 - Merkezi Konfigürasyon Yönetimi
 *
 * Tüm modüllerin konfigürasyonlarını tek yerden yönetir.
 * Environment variables, defaults, validation desteği.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
exports.getConfigManager = getConfigManager;
const fs_1 = require("fs");
const path_1 = require("path");
// ========================
// Default Configuration
// ========================
const DEFAULT_CONFIG = {
    llm: {
        provider: 'ollama',
        model: 'llama3.2',
        baseUrl: 'http://localhost:11434',
        temperature: 0.7,
        maxTokens: 2048,
        timeout: 60000, // 60 seconds
        retryAttempts: 3,
        retryDelay: 1000, // 1 second
    },
    vector: {
        dimensions: 384,
        persistPath: '.funclib/vectors',
        autoSave: true,
        similarityThreshold: 0.7,
    },
    graph: {
        persistPath: '.funclib/graph.json',
        autoLoad: true,
        maxNodes: 100000,
        maxEdges: 500000,
    },
    cache: {
        enabled: true,
        ttl: 3600, // 1 hour
        maxSize: 100, // 100 MB
        persistPath: '.funclib/cache',
    },
    log: {
        level: 'info',
        format: 'text',
        timestamps: true,
        colors: true,
    },
    index: {
        include: ['**/*.ts', '**/*.js', '**/*.py', '**/*.go', '**/*.rs', '**/*.java', '**/*.vue'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
        maxFileSize: 1024 * 1024, // 1 MB
        watchMode: false,
    },
};
// ========================
// Config Manager Class
// ========================
class ConfigManager {
    config;
    configPath;
    initialized = false;
    constructor() {
        this.config = {
            projectPath: process.cwd(),
            ...DEFAULT_CONFIG,
        };
        this.configPath = '';
    }
    /**
     * Initialize configuration for a project
     */
    init(projectPath) {
        this.config.projectPath = projectPath;
        this.configPath = (0, path_1.join)(projectPath, '.funclib', 'config.json');
        // Load from environment variables
        this.loadFromEnv();
        // Load from config file if exists
        this.loadFromFile();
        this.initialized = true;
    }
    /**
     * Load configuration from environment variables
     */
    loadFromEnv() {
        const env = process.env;
        // LLM settings
        if (env.FUNCLIB_LLM_PROVIDER) {
            this.config.llm.provider = env.FUNCLIB_LLM_PROVIDER;
        }
        if (env.FUNCLIB_LLM_MODEL) {
            this.config.llm.model = env.FUNCLIB_LLM_MODEL;
        }
        if (env.OLLAMA_HOST) {
            this.config.llm.baseUrl = env.OLLAMA_HOST;
        }
        if (env.GROQ_API_KEY) {
            this.config.llm.apiKey = env.GROQ_API_KEY;
            this.config.llm.provider = 'groq';
        }
        if (env.TOGETHER_API_KEY) {
            this.config.llm.apiKey = env.TOGETHER_API_KEY;
            this.config.llm.provider = 'together';
        }
        if (env.OPENAI_API_KEY) {
            this.config.llm.apiKey = env.OPENAI_API_KEY;
            this.config.llm.provider = 'openai';
        }
        if (env.FUNCLIB_LLM_TIMEOUT) {
            this.config.llm.timeout = parseInt(env.FUNCLIB_LLM_TIMEOUT, 10);
        }
        if (env.FUNCLIB_LLM_RETRY) {
            this.config.llm.retryAttempts = parseInt(env.FUNCLIB_LLM_RETRY, 10);
        }
        // Log settings
        if (env.FUNCLIB_LOG_LEVEL) {
            this.config.log.level = env.FUNCLIB_LOG_LEVEL;
        }
        if (env.FUNCLIB_LOG_FORMAT) {
            this.config.log.format = env.FUNCLIB_LOG_FORMAT;
        }
        // Cache settings
        if (env.FUNCLIB_CACHE_ENABLED) {
            this.config.cache.enabled = env.FUNCLIB_CACHE_ENABLED === 'true';
        }
        if (env.FUNCLIB_CACHE_TTL) {
            this.config.cache.ttl = parseInt(env.FUNCLIB_CACHE_TTL, 10);
        }
    }
    /**
     * Load configuration from file
     */
    loadFromFile() {
        if ((0, fs_1.existsSync)(this.configPath)) {
            try {
                const fileContent = (0, fs_1.readFileSync)(this.configPath, 'utf-8');
                const fileConfig = JSON.parse(fileContent);
                this.config = this.mergeDeep(this.config, fileConfig);
            }
            catch (error) {
                // Ignore parse errors, use defaults
            }
        }
    }
    /**
     * Save current configuration to file
     */
    save() {
        const dir = (0, path_1.dirname)(this.configPath);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        // Don't save projectPath (it's runtime-specific)
        const { projectPath, ...configToSave } = this.config;
        (0, fs_1.writeFileSync)(this.configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    }
    /**
     * Get entire configuration
     */
    getAll() {
        return { ...this.config };
    }
    /**
     * Get specific section
     */
    get(key) {
        return this.config[key];
    }
    /**
     * Update configuration
     */
    set(key, value) {
        if (typeof this.config[key] === 'object' && !Array.isArray(this.config[key])) {
            this.config[key] = { ...this.config[key], ...value };
        }
        else {
            this.config[key] = value;
        }
    }
    /**
     * Update entire section
     */
    update(updates) {
        this.config = this.mergeDeep(this.config, updates);
    }
    /**
     * Reset to defaults
     */
    reset() {
        this.config = {
            projectPath: this.config.projectPath,
            ...DEFAULT_CONFIG,
        };
    }
    /**
     * Get absolute path relative to project
     */
    resolvePath(relativePath) {
        if (relativePath.startsWith('/') || relativePath.match(/^[A-Z]:/i)) {
            return relativePath;
        }
        return (0, path_1.join)(this.config.projectPath, relativePath);
    }
    /**
     * Deep merge utility
     */
    mergeDeep(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== undefined) {
                if (typeof source[key] === 'object' &&
                    source[key] !== null &&
                    !Array.isArray(source[key]) &&
                    typeof result[key] === 'object' &&
                    result[key] !== null) {
                    result[key] = this.mergeDeep(result[key], source[key]);
                }
                else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    }
    /**
     * Validate configuration
     */
    validate() {
        const errors = [];
        // LLM validation
        if (!['ollama', 'groq', 'together', 'openai'].includes(this.config.llm.provider)) {
            errors.push(`Invalid LLM provider: ${this.config.llm.provider}`);
        }
        if (this.config.llm.timeout < 1000) {
            errors.push('LLM timeout should be at least 1000ms');
        }
        if (this.config.llm.retryAttempts < 0) {
            errors.push('Retry attempts cannot be negative');
        }
        // Log validation
        if (!['debug', 'info', 'warn', 'error', 'silent'].includes(this.config.log.level)) {
            errors.push(`Invalid log level: ${this.config.log.level}`);
        }
        // Cache validation
        if (this.config.cache.ttl < 0) {
            errors.push('Cache TTL cannot be negative');
        }
        if (this.config.cache.maxSize < 1) {
            errors.push('Cache max size should be at least 1 MB');
        }
        return { valid: errors.length === 0, errors };
    }
    /**
     * Check if initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Print configuration (for debugging)
     */
    print() {
        const logger = (0, logger_1.getLogger)();
        logger.info('📋 FuncLib Configuration:');
        logger.info(`   Project: ${this.config.projectPath}`);
        logger.info(`   LLM: ${this.config.llm.provider}/${this.config.llm.model}`);
        logger.info(`   Log Level: ${this.config.log.level}`);
        logger.info(`   Cache: ${this.config.cache.enabled ? 'enabled' : 'disabled'}`);
    }
}
exports.ConfigManager = ConfigManager;
// ========================
// Singleton Instance
// ========================
let configManagerInstance = null;
function getConfigManager() {
    if (!configManagerInstance) {
        configManagerInstance = new ConfigManager();
    }
    return configManagerInstance;
}
// Forward declaration for circular dependency
const logger_1 = require("./logger");
//# sourceMappingURL=configManager.js.map