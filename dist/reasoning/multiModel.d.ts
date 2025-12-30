/**
 * FuncLib v4 - Multi-Model Ensemble
 * Birden fazla LLM'i koordineli şekilde kullan
 */
export interface ModelConfig {
    name: string;
    provider: 'ollama' | 'groq' | 'together';
    model: string;
    baseUrl: string;
    apiKey?: string;
    priority: number;
    specialties: string[];
    maxTokens?: number;
}
export interface EnsembleConfig {
    models: ModelConfig[];
    strategy: 'first_available' | 'best_for_task' | 'consensus' | 'cascade';
    timeout: number;
    retries: number;
}
export interface EnsembleResult {
    response: string;
    model: string;
    confidence: number;
    alternatives: Array<{
        model: string;
        response: string;
        confidence: number;
    }>;
    metadata: {
        strategy: string;
        totalTime: number;
        tokensUsed: number;
        modelsConsulted: string[];
    };
}
export interface TaskClassification {
    type: 'code' | 'debugging' | 'refactoring' | 'documentation' | 'general';
    complexity: 'simple' | 'medium' | 'complex';
    language?: string;
    context?: string;
}
export declare class MultiModelEnsemble {
    private config;
    private clients;
    constructor(config?: Partial<EnsembleConfig>);
    addModel(modelConfig: ModelConfig): void;
    removeModel(name: string): void;
    query(prompt: string, systemPrompt?: string): Promise<EnsembleResult>;
    queryForCode(code: string, instruction: string): Promise<EnsembleResult>;
    queryForDebugging(code: string, error: string): Promise<EnsembleResult>;
    queryForRefactoring(code: string): Promise<EnsembleResult>;
    classifyTask(prompt: string): TaskClassification;
    selectModelsForTask(task: TaskClassification): ModelConfig[];
    getModels(): ModelConfig[];
    getConfig(): EnsembleConfig;
}
export declare function getMultiModelEnsemble(config?: Partial<EnsembleConfig>): MultiModelEnsemble;
export default MultiModelEnsemble;
