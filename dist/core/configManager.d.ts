/**
 * FuncLib v4 - Merkezi Konfigürasyon Yönetimi
 *
 * Tüm modüllerin konfigürasyonlarını tek yerden yönetir.
 * Environment variables, defaults, validation desteği.
 */
export interface LLMSettings {
    provider: 'ollama' | 'groq' | 'together' | 'openai';
    model: string;
    baseUrl: string;
    apiKey?: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
}
export interface VectorSettings {
    dimensions: number;
    persistPath: string;
    autoSave: boolean;
    similarityThreshold: number;
}
export interface GraphSettings {
    persistPath: string;
    autoLoad: boolean;
    maxNodes: number;
    maxEdges: number;
}
export interface CacheSettings {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    persistPath: string;
}
export interface LogSettings {
    level: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    format: 'text' | 'json';
    timestamps: boolean;
    colors: boolean;
    file?: string;
}
export interface IndexSettings {
    include: string[];
    exclude: string[];
    maxFileSize: number;
    watchMode: boolean;
}
export interface FuncLibConfig {
    projectPath: string;
    llm: LLMSettings;
    vector: VectorSettings;
    graph: GraphSettings;
    cache: CacheSettings;
    log: LogSettings;
    index: IndexSettings;
}
declare class ConfigManager {
    private config;
    private configPath;
    private initialized;
    constructor();
    /**
     * Initialize configuration for a project
     */
    init(projectPath: string): void;
    /**
     * Load configuration from environment variables
     */
    private loadFromEnv;
    /**
     * Load configuration from file
     */
    private loadFromFile;
    /**
     * Save current configuration to file
     */
    save(): void;
    /**
     * Get entire configuration
     */
    getAll(): FuncLibConfig;
    /**
     * Get specific section
     */
    get<K extends keyof FuncLibConfig>(key: K): FuncLibConfig[K];
    /**
     * Update configuration
     */
    set<K extends keyof FuncLibConfig>(key: K, value: Partial<FuncLibConfig[K]>): void;
    /**
     * Update entire section
     */
    update(updates: Partial<FuncLibConfig>): void;
    /**
     * Reset to defaults
     */
    reset(): void;
    /**
     * Get absolute path relative to project
     */
    resolvePath(relativePath: string): string;
    /**
     * Deep merge utility
     */
    private mergeDeep;
    /**
     * Validate configuration
     */
    validate(): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Check if initialized
     */
    isInitialized(): boolean;
    /**
     * Print configuration (for debugging)
     */
    print(): void;
}
export declare function getConfigManager(): ConfigManager;
export { ConfigManager };
