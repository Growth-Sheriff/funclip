/**
 * FuncLib v4 - Code Embedding Engine
 * Transformers.js kullanarak kod embedding'leri oluşturur
 */
export interface EmbeddingResult {
    text: string;
    embedding: number[];
    model: string;
    timestamp: Date;
}
export interface EmbeddingCache {
    [key: string]: {
        embedding: number[];
        timestamp: number;
    };
}
export declare class CodeEmbedder {
    private model;
    private modelName;
    private cache;
    private cacheMaxAge;
    private isLoading;
    private loadPromise;
    constructor(modelName?: string);
    /**
     * Model'i lazy load et
     */
    ensureLoaded(): Promise<void>;
    private loadModel;
    /**
     * Tek bir metin için embedding oluştur
     */
    embed(text: string): Promise<number[]>;
    /**
     * Çoklu metin için batch embedding
     */
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
    /**
     * Kod için özelleştirilmiş embedding
     * Fonksiyon signature + body + comments birleştirilir
     */
    embedCode(code: string, context?: {
        name?: string;
        kind?: string;
        file?: string;
        jsdoc?: string;
    }): Promise<number[]>;
    /**
     * İki embedding arasındaki benzerliği hesapla (cosine similarity)
     */
    cosineSimilarity(a: number[], b: number[]): number;
    /**
     * En benzer embedding'leri bul
     */
    findMostSimilar(query: number[], embeddings: Array<{
        id: string;
        embedding: number[];
    }>, k?: number): Array<{
        id: string;
        similarity: number;
    }>;
    /**
     * Cache'i temizle
     */
    clearCache(): void;
    /**
     * Cache istatistikleri
     */
    getCacheStats(): {
        size: number;
        hitRate: number;
    };
    private getCacheKey;
}
export declare function getEmbedder(): CodeEmbedder;
export default CodeEmbedder;
