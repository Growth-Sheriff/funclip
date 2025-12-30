/**
 * FuncLib v4 - LLM Reasoning Engine
 * Ollama ile lokal LLM entegrasyonu
 */
export interface LLMConfig {
    provider: 'ollama' | 'groq' | 'together';
    model: string;
    baseUrl: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
}
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface ReasoningResult {
    answer: string;
    confidence: number;
    reasoning: string;
    sources: string[];
    suggestions: string[];
}
export declare class LLMClient {
    private config;
    constructor(config?: Partial<LLMConfig>);
    /**
     * Ollama'nın çalışıp çalışmadığını kontrol et
     */
    checkOllama(): Promise<boolean>;
    /**
     * LLM'e mesaj gönder
     */
    chat(messages: LLMMessage[]): Promise<LLMResponse>;
    /**
     * Ollama API
     */
    private chatOllama;
    /**
     * OpenAI uyumlu API (Groq, Together, vb.)
     */
    private chatOpenAIFormat;
    /**
     * HTTP request helper
     */
    private httpRequest;
    /**
     * Mevcut config
     */
    getConfig(): LLMConfig;
    /**
     * Provider değiştir
     */
    setProvider(provider: 'ollama' | 'groq' | 'together', apiKey?: string): void;
}
export declare class ReasoningEngine {
    private llm;
    private systemPrompt;
    constructor(llmConfig?: Partial<LLMConfig>);
    /**
     * Kod hakkında soru sor
     */
    ask(question: string, context?: {
        code?: string;
        symbols?: Array<{
            name: string;
            kind: string;
            file: string;
        }>;
        references?: Array<{
            symbol: string;
            file: string;
            line: number;
        }>;
    }): Promise<ReasoningResult>;
    /**
     * Bug tahmini
     */
    predictBugs(code: string, context?: string): Promise<ReasoningResult>;
    /**
     * Etki analizi
     */
    analyzeImpact(change: string, affectedSymbols: string[]): Promise<ReasoningResult>;
    /**
     * Refactoring önerisi
     */
    suggestRefactoring(code: string, goal?: string): Promise<ReasoningResult>;
    /**
     * LLM cevabını parse et
     */
    private parseResponse;
    /**
     * Ollama durumunu kontrol et
     */
    checkHealth(): Promise<{
        available: boolean;
        model: string;
        provider: string;
    }>;
}
export declare function getReasoningEngine(config?: Partial<LLMConfig>): ReasoningEngine;
export default ReasoningEngine;
