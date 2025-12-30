/**
 * FuncLib v4 - Hybrid Embedder
 * Birden fazla embedding modelini kombine et
 */
import { CodeEmbedder } from './codeEmbedder';
export interface HybridEmbeddingConfig {
    models: Array<{
        name: string;
        weight: number;
        embedder?: CodeEmbedder;
    }>;
    aggregation: 'weighted_mean' | 'concat' | 'max_pool';
    normalize: boolean;
}
export interface HybridEmbedding {
    vector: number[];
    modelContributions: Map<string, number[]>;
    metadata: {
        aggregation: string;
        modelCount: number;
        dimension: number;
    };
}
export declare class HybridEmbedder {
    private config;
    private embedder;
    private ready;
    constructor(config?: Partial<HybridEmbeddingConfig>);
    initialize(): Promise<void>;
    embed(text: string): Promise<HybridEmbedding>;
    embedBatch(texts: string[]): Promise<HybridEmbedding[]>;
    embedCode(code: string, language: string): Promise<HybridEmbedding>;
    similarity(a: HybridEmbedding, b: HybridEmbedding): number;
    private cosineSimilarity;
    findSimilar(query: string, candidates: string[], topK?: number): Promise<Array<{
        text: string;
        similarity: number;
    }>>;
    clusterTexts(texts: string[], numClusters?: number): Promise<Map<number, string[]>>;
    getConfig(): HybridEmbeddingConfig;
    updateConfig(config: Partial<HybridEmbeddingConfig>): void;
}
export declare function getHybridEmbedder(config?: Partial<HybridEmbeddingConfig>): HybridEmbedder;
export default HybridEmbedder;
