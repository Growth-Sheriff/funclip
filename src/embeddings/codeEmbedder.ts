/**
 * FuncLib v4 - Code Embedding Engine
 * Transformers.js kullanarak kod embedding'leri oluşturur
 */

// @ts-ignore - Transformers.js types
import { pipeline } from '@xenova/transformers';

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

export class CodeEmbedder {
  private model: any = null;
  private modelName: string;
  private cache: EmbeddingCache = {};
  private cacheMaxAge: number = 1000 * 60 * 60; // 1 saat
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;

  constructor(modelName: string = 'Xenova/all-MiniLM-L6-v2') {
    this.modelName = modelName;
  }

  /**
   * Model'i lazy load et
   */
  async ensureLoaded(): Promise<void> {
    if (this.model) return;
    
    if (this.isLoading && this.loadPromise) {
      await this.loadPromise;
      return;
    }

    this.isLoading = true;
    this.loadPromise = this.loadModel();
    await this.loadPromise;
    this.isLoading = false;
  }

  private async loadModel(): Promise<void> {
    console.log(`📦 Model yükleniyor: ${this.modelName}`);
    const startTime = Date.now();
    
    try {
      this.model = await pipeline('feature-extraction', this.modelName, {
        quantized: true, // Daha hızlı, daha az bellek
      });
      console.log(`✅ Model yüklendi (${Date.now() - startTime}ms)`);
    } catch (error) {
      console.error('❌ Model yükleme hatası:', error);
      throw error;
    }
  }

  /**
   * Tek bir metin için embedding oluştur
   */
  async embed(text: string): Promise<number[]> {
    // Cache kontrolü
    const cacheKey = this.getCacheKey(text);
    const cached = this.cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.embedding;
    }

    await this.ensureLoaded();
    
    if (!this.model) {
      throw new Error('Model yüklenemedi');
    }

    const output = await this.model(text, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(output.data as Float32Array);
    
    // Cache'e kaydet
    this.cache[cacheKey] = {
      embedding,
      timestamp: Date.now(),
    };

    return embedding;
  }

  /**
   * Çoklu metin için batch embedding
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    await this.ensureLoaded();
    
    const results: EmbeddingResult[] = [];
    
    // Batch işleme (paralel ama kontrollü)
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await Promise.all(
        batch.map(async (text) => ({
          text,
          embedding: await this.embed(text),
          model: this.modelName,
          timestamp: new Date(),
        }))
      );
      results.push(...embeddings);
    }

    return results;
  }

  /**
   * Kod için özelleştirilmiş embedding
   * Fonksiyon signature + body + comments birleştirilir
   */
  async embedCode(code: string, context?: {
    name?: string;
    kind?: string;
    file?: string;
    jsdoc?: string;
  }): Promise<number[]> {
    // Zenginleştirilmiş metin oluştur
    let enrichedText = '';
    
    if (context?.kind) {
      enrichedText += `[${context.kind}] `;
    }
    if (context?.name) {
      enrichedText += `${context.name}: `;
    }
    if (context?.jsdoc) {
      enrichedText += `${context.jsdoc} `;
    }
    
    // Kod'u ekle (ilk 500 karakter)
    enrichedText += code.slice(0, 500);
    
    return this.embed(enrichedText);
  }

  /**
   * İki embedding arasındaki benzerliği hesapla (cosine similarity)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embedding boyutları eşleşmiyor');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * En benzer embedding'leri bul
   */
  findMostSimilar(
    query: number[],
    embeddings: Array<{ id: string; embedding: number[] }>,
    k: number = 10
  ): Array<{ id: string; similarity: number }> {
    const scored = embeddings.map((item) => ({
      id: item.id,
      similarity: this.cosineSimilarity(query, item.embedding),
    }));

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }

  /**
   * Cache'i temizle
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Cache istatistikleri
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: Object.keys(this.cache).length,
      hitRate: 0, // TODO: Hit rate tracking
    };
  }

  private getCacheKey(text: string): string {
    // Basit hash fonksiyonu
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${this.modelName}:${hash}`;
  }
}

// Singleton instance
let embedderInstance: CodeEmbedder | null = null;

export function getEmbedder(): CodeEmbedder {
  if (!embedderInstance) {
    embedderInstance = new CodeEmbedder();
  }
  return embedderInstance;
}

export default CodeEmbedder;
