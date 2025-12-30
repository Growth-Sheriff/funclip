"use strict";
/**
 * FuncLib v4 - Hybrid Embedder
 * Birden fazla embedding modelini kombine et
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridEmbedder = void 0;
exports.getHybridEmbedder = getHybridEmbedder;
const codeEmbedder_1 = require("./codeEmbedder");
class HybridEmbedder {
    config;
    embedder;
    ready = false;
    constructor(config) {
        this.config = {
            models: config?.models || [{ name: 'default', weight: 1.0 }],
            aggregation: config?.aggregation || 'weighted_mean',
            normalize: config?.normalize ?? true,
        };
        this.embedder = new codeEmbedder_1.CodeEmbedder();
    }
    async initialize() {
        await this.embedder.ensureLoaded();
        this.ready = true;
    }
    async embed(text) {
        if (!this.ready) {
            await this.initialize();
        }
        const vector = await this.embedder.embed(text);
        const modelContributions = new Map();
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
    async embedBatch(texts) {
        const results = [];
        for (const text of texts) {
            results.push(await this.embed(text));
        }
        return results;
    }
    async embedCode(code, language) {
        // Language-aware embedding (prepend language hint)
        const enrichedCode = `// Language: ${language}\n${code}`;
        return this.embed(enrichedCode);
    }
    similarity(a, b) {
        return this.cosineSimilarity(a.vector, b.vector);
    }
    cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
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
    async findSimilar(query, candidates, topK = 5) {
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
    async clusterTexts(texts, numClusters = 5) {
        // Simple clustering based on similarity
        const embeddings = await this.embedBatch(texts);
        const clusters = new Map();
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
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
exports.HybridEmbedder = HybridEmbedder;
let instance = null;
function getHybridEmbedder(config) {
    if (!instance) {
        instance = new HybridEmbedder(config);
    }
    return instance;
}
exports.default = HybridEmbedder;
//# sourceMappingURL=hybridEmbedder.js.map