/**
 * FuncLib v4 - Vector Store
 * ChromaDB veya in-memory vector storage
 */
import { CodeEmbedder } from '../embeddings/codeEmbedder';
export interface VectorDocument {
    id: string;
    content: string;
    embedding?: number[];
    metadata: {
        file: string;
        line: number;
        kind: string;
        name: string;
        [key: string]: any;
    };
}
export interface SearchResult {
    id: string;
    content: string;
    similarity: number;
    metadata: VectorDocument['metadata'];
}
export interface VectorStoreConfig {
    persistPath?: string;
    collectionName?: string;
    embedder?: CodeEmbedder;
}
export declare class VectorStore {
    private documents;
    private embeddings;
    private embedder;
    private persistPath;
    private collectionName;
    private isDirty;
    constructor(config?: VectorStoreConfig);
    /**
     * Döküman ekle
     */
    add(doc: Omit<VectorDocument, 'embedding'>): Promise<void>;
    /**
     * Çoklu döküman ekle (batch)
     */
    addBatch(docs: Array<Omit<VectorDocument, 'embedding'>>): Promise<void>;
    /**
     * Semantic search
     */
    search(query: string, k?: number): Promise<SearchResult[]>;
    /**
     * Hybrid search (keyword + semantic)
     */
    hybridSearch(query: string, options?: {
        k?: number;
        keywordWeight?: number;
        semanticWeight?: number;
        filters?: Partial<VectorDocument['metadata']>;
    }): Promise<SearchResult[]>;
    /**
     * ID ile döküman getir
     */
    get(id: string): VectorDocument | undefined;
    /**
     * Döküman sil
     */
    delete(id: string): boolean;
    /**
     * Tümünü temizle
     */
    clear(): void;
    /**
     * Döküman sayısı
     */
    get size(): number;
    /**
     * Disk'e kaydet
     */
    save(): Promise<void>;
    /**
     * Disk'ten yükle
     */
    load(): void;
    /**
     * İstatistikler
     */
    getStats(): {
        documentCount: number;
        embeddingDimension: number;
        collectionName: string;
    };
}
export declare function getVectorStore(name?: string, config?: VectorStoreConfig): VectorStore;
export default VectorStore;
