/**
 * FuncLib v4 - Smart Query Engine
 * Semantic search + LLM reasoning
 */
import { ImpactResult } from '../memory/knowledgeGraph';
import { ReasoningResult } from '../reasoning/llmClient';
export interface QueryResult {
    answer: string;
    relevantCode: Array<{
        file: string;
        line: number;
        name: string;
        kind: string;
        snippet: string;
        similarity: number;
    }>;
    suggestions: string[];
    confidence: number;
    dataFlow?: string;
    impact?: ImpactResult;
}
export interface AskOptions {
    useLLM?: boolean;
    maxResults?: number;
    includeCode?: boolean;
    analyzeImpact?: boolean;
}
export declare class QueryEngine {
    private vectorStore;
    private graph;
    private reasoning;
    private indexManager;
    private projectPath;
    constructor(projectPath: string);
    /**
     * Doğal dil sorgusu
     */
    ask(question: string, options?: AskOptions): Promise<QueryResult>;
    /**
     * Temel cevap oluştur (LLM olmadan)
     */
    private generateBasicAnswer;
    /**
     * Symbol'ün nerede kullanıldığını bul
     */
    findUsages(symbolName: string): Promise<QueryResult>;
    /**
     * Bug tahmini
     */
    predictBugs(filePath?: string): Promise<ReasoningResult>;
    /**
     * Değişiklik etkisi analizi
     */
    analyzeChange(symbolName: string): Promise<QueryResult>;
    /**
     * Vector store'u index ile doldur
     */
    buildVectorIndex(): Promise<void>;
    /**
     * Knowledge graph'ı index ile doldur
     */
    buildKnowledgeGraph(): void;
    private findSymbolNodeId;
    /**
     * Sistemin hazır olup olmadığını kontrol et
     */
    checkReady(): Promise<{
        indexReady: boolean;
        vectorReady: boolean;
        graphReady: boolean;
        llmReady: boolean;
        symbolCount: number;
        vectorCount: number;
        nodeCount: number;
    }>;
}
export default QueryEngine;
