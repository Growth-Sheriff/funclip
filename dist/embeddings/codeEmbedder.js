"use strict";
/**
 * FuncLib v4 - Code Embedding Engine
 * Transformers.js kullanarak kod embedding'leri oluşturur
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeEmbedder = void 0;
exports.getEmbedder = getEmbedder;
// @ts-ignore - Transformers.js types
const transformers_1 = require("@xenova/transformers");
const logger_1 = require("../core/logger");
const logger = (0, logger_1.getLogger)().child('Embedder');
class CodeEmbedder {
    model = null;
    modelName;
    cache = {};
    cacheMaxAge = 1000 * 60 * 60; // 1 saat
    isLoading = false;
    loadPromise = null;
    constructor(modelName = 'Xenova/all-MiniLM-L6-v2') {
        this.modelName = modelName;
    }
    /**
     * Model'i lazy load et
     */
    async ensureLoaded() {
        if (this.model)
            return;
        if (this.isLoading && this.loadPromise) {
            await this.loadPromise;
            return;
        }
        this.isLoading = true;
        this.loadPromise = this.loadModel();
        await this.loadPromise;
        this.isLoading = false;
    }
    async loadModel() {
        logger.info(`📦 Model yükleniyor: ${this.modelName}`);
        const startTime = Date.now();
        try {
            this.model = await (0, transformers_1.pipeline)('feature-extraction', this.modelName, {
                quantized: true, // Daha hızlı, daha az bellek
            });
            logger.info(`✅ Model yüklendi (${Date.now() - startTime}ms)`);
        }
        catch (error) {
            logger.error('❌ Model yükleme hatası:', { error: error.message });
            throw error;
        }
    }
    /**
     * Tek bir metin için embedding oluştur
     */
    async embed(text) {
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
        const embedding = Array.from(output.data);
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
    async embedBatch(texts) {
        await this.ensureLoaded();
        const results = [];
        // Batch işleme (paralel ama kontrollü)
        const batchSize = 10;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const embeddings = await Promise.all(batch.map(async (text) => ({
                text,
                embedding: await this.embed(text),
                model: this.modelName,
                timestamp: new Date(),
            })));
            results.push(...embeddings);
        }
        return results;
    }
    /**
     * Kod için özelleştirilmiş embedding
     * Fonksiyon signature + body + comments birleştirilir
     */
    async embedCode(code, context) {
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
    cosineSimilarity(a, b) {
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
    findMostSimilar(query, embeddings, k = 10) {
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
    clearCache() {
        this.cache = {};
    }
    /**
     * Cache istatistikleri
     */
    getCacheStats() {
        return {
            size: Object.keys(this.cache).length,
            hitRate: 0, // TODO: Hit rate tracking
        };
    }
    getCacheKey(text) {
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
exports.CodeEmbedder = CodeEmbedder;
// Singleton instance
let embedderInstance = null;
function getEmbedder() {
    if (!embedderInstance) {
        embedderInstance = new CodeEmbedder();
    }
    return embedderInstance;
}
exports.default = CodeEmbedder;
//# sourceMappingURL=codeEmbedder.js.map