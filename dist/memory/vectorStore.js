"use strict";
/**
 * FuncLib v4 - Vector Store
 * ChromaDB veya in-memory vector storage
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStore = void 0;
exports.getVectorStore = getVectorStore;
const codeEmbedder_1 = require("../embeddings/codeEmbedder");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class VectorStore {
    documents = new Map();
    embeddings = new Map();
    embedder;
    persistPath;
    collectionName;
    isDirty = false;
    constructor(config = {}) {
        this.embedder = config.embedder || (0, codeEmbedder_1.getEmbedder)();
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
    async add(doc) {
        // Embedding oluştur
        const embedding = await this.embedder.embedCode(doc.content, {
            name: doc.metadata.name,
            kind: doc.metadata.kind,
            file: doc.metadata.file,
        });
        const fullDoc = {
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
    async addBatch(docs) {
        console.log(`📥 ${docs.length} döküman ekleniyor...`);
        const batchSize = 50;
        let processed = 0;
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = docs.slice(i, i + batchSize);
            await Promise.all(batch.map(doc => this.add(doc)));
            processed += batch.length;
            if (processed % 100 === 0) {
                console.log(`  → ${processed}/${docs.length} işlendi`);
            }
        }
        console.log(`✅ ${docs.length} döküman eklendi`);
        // Persist
        if (this.persistPath) {
            await this.save();
        }
    }
    /**
     * Semantic search
     */
    async search(query, k = 10) {
        if (this.documents.size === 0) {
            return [];
        }
        // Query embedding
        const queryEmbedding = await this.embedder.embed(query);
        // Tüm dökümanlarla karşılaştır
        const results = [];
        for (const [id, doc] of this.documents) {
            const embedding = this.embeddings.get(id);
            if (!embedding)
                continue;
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
    async hybridSearch(query, options = {}) {
        const { k = 10, keywordWeight = 0.3, semanticWeight = 0.7, filters, } = options;
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
                if (contentLower.includes(keyword))
                    keywordScore += 0.5;
                if (nameLower.includes(keyword))
                    keywordScore += 1;
            }
            keywordScore = Math.min(keywordScore / keywords.length, 1);
            // Hybrid score
            const hybridScore = result.similarity * semanticWeight +
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
                    if (r.metadata[key] !== value)
                        return false;
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
    get(id) {
        return this.documents.get(id);
    }
    /**
     * Döküman sil
     */
    delete(id) {
        const deleted = this.documents.delete(id);
        this.embeddings.delete(id);
        if (deleted)
            this.isDirty = true;
        return deleted;
    }
    /**
     * Tümünü temizle
     */
    clear() {
        this.documents.clear();
        this.embeddings.clear();
        this.isDirty = true;
    }
    /**
     * Döküman sayısı
     */
    get size() {
        return this.documents.size;
    }
    /**
     * Disk'e kaydet
     */
    async save() {
        if (!this.persistPath || !this.isDirty)
            return;
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
        console.log(`💾 Vector store kaydedildi: ${this.persistPath}`);
    }
    /**
     * Disk'ten yükle
     */
    load() {
        if (!this.persistPath || !fs.existsSync(this.persistPath))
            return;
        try {
            const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
            this.documents = new Map(data.documents);
            this.embeddings = new Map(data.embeddings);
            this.collectionName = data.collectionName || 'default';
            console.log(`📂 Vector store yüklendi: ${this.documents.size} döküman`);
        }
        catch (error) {
            console.error('Vector store yükleme hatası:', error);
        }
    }
    /**
     * İstatistikler
     */
    getStats() {
        const firstEmbedding = this.embeddings.values().next().value;
        return {
            documentCount: this.documents.size,
            embeddingDimension: firstEmbedding?.length || 0,
            collectionName: this.collectionName,
        };
    }
}
exports.VectorStore = VectorStore;
// Singleton factory
const stores = new Map();
function getVectorStore(name = 'default', config) {
    if (!stores.has(name)) {
        stores.set(name, new VectorStore(config));
    }
    return stores.get(name);
}
exports.default = VectorStore;
//# sourceMappingURL=vectorStore.js.map