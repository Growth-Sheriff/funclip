/**
 * FuncLib v4 - Vector Store
 * ChromaDB veya in-memory vector storage
 */

import { CodeEmbedder, getEmbedder } from '../embeddings/codeEmbedder';
import { getLogger } from '../core/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger().child('VectorStore');

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

export class VectorStore {
  private documents: Map<string, VectorDocument> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private embedder: CodeEmbedder;
  private persistPath: string | null;
  private collectionName: string;
  private isDirty: boolean = false;

  constructor(config: VectorStoreConfig = {}) {
    this.embedder = config.embedder || getEmbedder();
    this.persistPath = config.persistPath || null;
    this.collectionName = config.collectionName || 'default';
    
    // Persist path varsa yükle
    if (this.persistPath) {
      this.load();
    }
  }

  /**
   * Döküman ekle
   */
  async add(doc: Omit<VectorDocument, 'embedding'>): Promise<void> {
    // Embedding oluştur
    const embedding = await this.embedder.embedCode(doc.content, {
      name: doc.metadata.name,
      kind: doc.metadata.kind,
      file: doc.metadata.file,
    });

    const fullDoc: VectorDocument = {
      ...doc,
      embedding,
    };

    this.documents.set(doc.id, fullDoc);
    this.embeddings.set(doc.id, embedding);
    this.isDirty = true;
  }

  /**
   * Çoklu döküman ekle (batch)
   */
  async addBatch(docs: Array<Omit<VectorDocument, 'embedding'>>): Promise<void> {
    logger.info(`📥 ${docs.length} döküman ekleniyor...`);
    
    const batchSize = 50;
    let processed = 0;
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      await Promise.all(batch.map(doc => this.add(doc)));
      processed += batch.length;
      
      if (processed % 100 === 0) {
        logger.debug(`  → ${processed}/${docs.length} işlendi`);
      }
    }
    
    logger.info(`✅ ${docs.length} döküman eklendi`);
    
    // Persist
    if (this.persistPath) {
      await this.save();
    }
  }

  /**
   * Semantic search
   */
  async search(query: string, k: number = 10): Promise<SearchResult[]> {
    if (this.documents.size === 0) {
      return [];
    }

    // Query embedding
    const queryEmbedding = await this.embedder.embed(query);

    // Tüm dökümanlarla karşılaştır
    const results: SearchResult[] = [];
    
    for (const [id, doc] of this.documents) {
      const embedding = this.embeddings.get(id);
      if (!embedding) continue;

      const similarity = this.embedder.cosineSimilarity(queryEmbedding, embedding);
      
      results.push({
        id,
        content: doc.content,
        similarity,
        metadata: doc.metadata,
      });
    }

    // En benzerlerini döndür
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /**
   * Hybrid search (keyword + semantic)
   */
  async hybridSearch(
    query: string,
    options: {
      k?: number;
      keywordWeight?: number;
      semanticWeight?: number;
      filters?: Partial<VectorDocument['metadata']>;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      k = 10,
      keywordWeight = 0.3,
      semanticWeight = 0.7,
      filters,
    } = options;

    // Semantic search
    const semanticResults = await this.search(query, k * 2);

    // Keyword search
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const hybridResults = semanticResults.map(result => {
      // Keyword score
      let keywordScore = 0;
      const contentLower = result.content.toLowerCase();
      const nameLower = result.metadata.name?.toLowerCase() || '';
      
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) keywordScore += 0.5;
        if (nameLower.includes(keyword)) keywordScore += 1;
      }
      keywordScore = Math.min(keywordScore / keywords.length, 1);

      // Hybrid score
      const hybridScore = 
        result.similarity * semanticWeight + 
        keywordScore * keywordWeight;

      return {
        ...result,
        similarity: hybridScore,
      };
    });

    // Filter uygula
    let filtered = hybridResults;
    if (filters) {
      filtered = hybridResults.filter(r => {
        for (const [key, value] of Object.entries(filters)) {
          if (r.metadata[key] !== value) return false;
        }
        return true;
      });
    }

    return filtered
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /**
   * ID ile döküman getir
   */
  get(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Döküman sil
   */
  delete(id: string): boolean {
    const deleted = this.documents.delete(id);
    this.embeddings.delete(id);
    if (deleted) this.isDirty = true;
    return deleted;
  }

  /**
   * Tümünü temizle
   */
  clear(): void {
    this.documents.clear();
    this.embeddings.clear();
    this.isDirty = true;
  }

  /**
   * Döküman sayısı
   */
  get size(): number {
    return this.documents.size;
  }

  /**
   * Disk'e kaydet
   */
  async save(): Promise<void> {
    if (!this.persistPath || !this.isDirty) return;

    const data = {
      collectionName: this.collectionName,
      documents: Array.from(this.documents.entries()),
      embeddings: Array.from(this.embeddings.entries()),
      version: '1.0',
      savedAt: new Date().toISOString(),
    };

    const dir = path.dirname(this.persistPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.persistPath, JSON.stringify(data));
    this.isDirty = false;
    logger.info(`💾 Vector store kaydedildi: ${this.persistPath}`);
  }

  /**
   * Disk'ten yükle
   */
  load(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
      this.documents = new Map(data.documents);
      this.embeddings = new Map(data.embeddings);
      this.collectionName = data.collectionName || 'default';
      logger.info(`📂 Vector store yüklendi: ${this.documents.size} döküman`);
    } catch (error) {
      logger.error('Vector store yükleme hatası:', { error: (error as Error).message });
    }
  }

  /**
   * İstatistikler
   */
  getStats(): {
    documentCount: number;
    embeddingDimension: number;
    collectionName: string;
  } {
    const firstEmbedding = this.embeddings.values().next().value;
    return {
      documentCount: this.documents.size,
      embeddingDimension: firstEmbedding?.length || 0,
      collectionName: this.collectionName,
    };
  }
}

// Singleton factory
const stores: Map<string, VectorStore> = new Map();

export function getVectorStore(name: string = 'default', config?: VectorStoreConfig): VectorStore {
  if (!stores.has(name)) {
    // Use default persist path if not provided
    const finalConfig = config || {};
    if (!finalConfig.persistPath) {
      const path = require('path');
      finalConfig.persistPath = path.join(process.cwd(), '.funclib', 'vectors.json');
    }
    stores.set(name, new VectorStore(finalConfig));
  }
  return stores.get(name)!;
}

export default VectorStore;
