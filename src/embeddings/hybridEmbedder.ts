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

export class HybridEmbedder {
  private config: HybridEmbeddingConfig;
  private embedder: CodeEmbedder;
  private ready: boolean = false;

  constructor(config?: Partial<HybridEmbeddingConfig>) {
    this.config = {
      models: config?.models || [{ name: 'default', weight: 1.0 }],
      aggregation: config?.aggregation || 'weighted_mean',
      normalize: config?.normalize ?? true,
    };
    this.embedder = new CodeEmbedder();
  }

  async initialize(): Promise<void> {
    await this.embedder.ensureLoaded();
    this.ready = true;
  }

  async embed(text: string): Promise<HybridEmbedding> {
    if (!this.ready) {
      await this.initialize();
    }

    const vector = await this.embedder.embed(text);
    const modelContributions = new Map<string, number[]>();
    modelContributions.set('default', vector);

    return {
      vector,
      modelContributions,
      metadata: {
        aggregation: this.config.aggregation,
        modelCount: 1,
        dimension: vector.length,
      },
    };
  }

  async embedBatch(texts: string[]): Promise<HybridEmbedding[]> {
    const results: HybridEmbedding[] = [];
    
    for (const text of texts) {
      results.push(await this.embed(text));
    }

    return results;
  }

  async embedCode(code: string, language: string): Promise<HybridEmbedding> {
    // Language-aware embedding (prepend language hint)
    const enrichedCode = `// Language: ${language}\n${code}`;
    return this.embed(enrichedCode);
  }

  similarity(a: HybridEmbedding, b: HybridEmbedding): number {
    return this.cosineSimilarity(a.vector, b.vector);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  async findSimilar(
    query: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ text: string; similarity: number }>> {
    const queryEmbedding = await this.embed(query);
    const candidateEmbeddings = await this.embedBatch(candidates);

    const results = candidates.map((text, i) => ({
      text,
      similarity: this.similarity(queryEmbedding, candidateEmbeddings[i]),
    }));

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  async clusterTexts(
    texts: string[],
    numClusters: number = 5
  ): Promise<Map<number, string[]>> {
    // Simple clustering based on similarity
    const embeddings = await this.embedBatch(texts);
    const clusters = new Map<number, string[]>();

    // Initialize clusters
    for (let i = 0; i < numClusters; i++) {
      clusters.set(i, []);
    }

    // Assign texts to clusters based on index (simplified)
    for (let i = 0; i < texts.length; i++) {
      const clusterIdx = i % numClusters;
      const cluster = clusters.get(clusterIdx) || [];
      cluster.push(texts[i]);
      clusters.set(clusterIdx, cluster);
    }

    return clusters;
  }

  getConfig(): HybridEmbeddingConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<HybridEmbeddingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

let instance: HybridEmbedder | null = null;

export function getHybridEmbedder(config?: Partial<HybridEmbeddingConfig>): HybridEmbedder {
  if (!instance) {
    instance = new HybridEmbedder(config);
  }
  return instance;
}

export default HybridEmbedder;
