"use strict";
/**
 * FuncLib v4 - Smart Query Engine
 * Semantic search + LLM reasoning
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
exports.QueryEngine = void 0;
const vectorStore_1 = require("../memory/vectorStore");
const knowledgeGraph_1 = require("../memory/knowledgeGraph");
const llmClient_1 = require("../reasoning/llmClient");
const indexManager_1 = require("../indexManager");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class QueryEngine {
    vectorStore;
    graph;
    reasoning;
    indexManager;
    projectPath;
    constructor(projectPath) {
        this.projectPath = projectPath;
        const dataPath = path.join(projectPath, '.funclib');
        this.vectorStore = (0, vectorStore_1.getVectorStore)('symbols', {
            persistPath: path.join(dataPath, 'vectors.json'),
        });
        this.graph = (0, knowledgeGraph_1.getKnowledgeGraph)(path.join(dataPath, 'graph.json'));
        this.reasoning = (0, llmClient_1.getReasoningEngine)();
        this.indexManager = new indexManager_1.IndexManager(projectPath);
        // Index'i yükle
        this.indexManager.load();
    }
    /**
     * Doğal dil sorgusu
     */
    async ask(question, options = {}) {
        const { useLLM = true, maxResults = 10, includeCode = true, analyzeImpact = false, } = options;
        console.log(`\n🔍 Sorgu: "${question}"`);
        // 1. Semantic search
        let searchResults = [];
        if (this.vectorStore.size > 0) {
            searchResults = await this.vectorStore.hybridSearch(question, { k: maxResults });
        }
        else {
            // Vector store boşsa, klasik aramaya düş
            const index = this.indexManager.getIndex();
            if (index) {
                const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                for (const [file, data] of Object.entries(index.files)) {
                    const fileData = data;
                    for (const symbol of fileData.symbols) {
                        const nameMatch = keywords.some(k => symbol.name.toLowerCase().includes(k));
                        if (nameMatch) {
                            searchResults.push({
                                id: `${file}:${symbol.name}`,
                                content: symbol.name,
                                similarity: 0.5,
                                metadata: {
                                    file,
                                    line: symbol.range.start.line,
                                    kind: symbol.kind,
                                    name: symbol.name,
                                },
                            });
                        }
                    }
                }
            }
        }
        // 2. Kod snippet'lerini topla
        const relevantCode = [];
        for (const result of searchResults.slice(0, maxResults)) {
            let snippet = '';
            if (includeCode) {
                try {
                    const filePath = path.join(this.projectPath, result.metadata.file);
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf-8');
                        const lines = content.split('\n');
                        const startLine = Math.max(0, result.metadata.line - 3);
                        const endLine = Math.min(lines.length, result.metadata.line + 10);
                        snippet = lines.slice(startLine, endLine).join('\n');
                    }
                }
                catch (e) {
                    // Ignore
                }
            }
            relevantCode.push({
                file: result.metadata.file,
                line: result.metadata.line,
                name: result.metadata.name,
                kind: result.metadata.kind,
                snippet,
                similarity: result.similarity,
            });
        }
        // 3. LLM ile cevap oluştur (opsiyonel)
        let answer = '';
        let suggestions = [];
        let confidence = 0.5;
        if (useLLM && relevantCode.length > 0) {
            try {
                const health = await this.reasoning.checkHealth();
                if (health.available) {
                    const llmResult = await this.reasoning.ask(question, {
                        symbols: relevantCode.map(r => ({
                            name: r.name,
                            kind: r.kind,
                            file: r.file,
                        })),
                        code: relevantCode[0]?.snippet,
                    });
                    answer = llmResult.answer;
                    suggestions = llmResult.suggestions;
                    confidence = llmResult.confidence;
                }
                else {
                    answer = this.generateBasicAnswer(question, relevantCode);
                    suggestions = ['Ollama kurun: `winget install Ollama.Ollama`'];
                }
            }
            catch (e) {
                answer = this.generateBasicAnswer(question, relevantCode);
            }
        }
        else {
            answer = this.generateBasicAnswer(question, relevantCode);
        }
        // 4. Impact analizi (opsiyonel)
        let impact;
        if (analyzeImpact && relevantCode.length > 0) {
            const mainSymbol = relevantCode[0];
            const nodeId = `${mainSymbol.file}:${mainSymbol.name}`;
            impact = this.graph.findImpact(nodeId);
        }
        return {
            answer,
            relevantCode,
            suggestions,
            confidence,
            impact,
        };
    }
    /**
     * Temel cevap oluştur (LLM olmadan)
     */
    generateBasicAnswer(question, results) {
        if (results.length === 0) {
            return 'İlgili kod bulunamadı. Daha spesifik bir sorgu deneyin.';
        }
        const mainResult = results[0];
        let answer = `🎯 **${mainResult.name}** (${mainResult.kind})\n`;
        answer += `📍 Dosya: ${mainResult.file}:${mainResult.line}\n\n`;
        if (results.length > 1) {
            answer += `📚 İlgili ${results.length - 1} sonuç daha bulundu:\n`;
            results.slice(1, 5).forEach(r => {
                answer += `  • ${r.name} (${r.kind}) @ ${r.file}\n`;
            });
        }
        return answer;
    }
    /**
     * Symbol'ün nerede kullanıldığını bul
     */
    async findUsages(symbolName) {
        const index = this.indexManager.getIndex();
        if (!index) {
            return {
                answer: 'Index bulunamadı. `funclib index` komutunu çalıştırın.',
                relevantCode: [],
                suggestions: [],
                confidence: 0,
            };
        }
        const usages = [];
        for (const [file, data] of Object.entries(index.files)) {
            const fileData = data;
            for (const ref of fileData.references) {
                if (ref.symbol === symbolName || ref.symbol.includes(symbolName)) {
                    usages.push({
                        file,
                        line: ref.range.start.line,
                        name: ref.symbol,
                        kind: ref.kind,
                        snippet: '',
                        similarity: 1,
                    });
                }
            }
        }
        // Definition'ı bul
        let definition = null;
        for (const [file, data] of Object.entries(index.files)) {
            const fileData = data;
            for (const symbol of fileData.symbols) {
                if (symbol.name === symbolName) {
                    definition = {
                        file,
                        line: symbol.range.start.line,
                        name: symbol.name,
                        kind: symbol.kind,
                        snippet: '',
                        similarity: 1,
                    };
                    break;
                }
            }
        }
        const answer = definition
            ? `📍 **${symbolName}** tanımı: ${definition.file}:${definition.line}\n\n🔗 ${usages.length} kullanım bulundu.`
            : `🔗 **${symbolName}** için ${usages.length} referans bulundu.`;
        return {
            answer,
            relevantCode: definition ? [definition, ...usages] : usages,
            suggestions: usages.length > 20
                ? ['Çok fazla kullanım var, refactoring düşünün']
                : [],
            confidence: 0.9,
        };
    }
    /**
     * Bug tahmini
     */
    async predictBugs(filePath) {
        const index = this.indexManager.getIndex();
        if (!index) {
            return {
                answer: 'Index bulunamadı.',
                confidence: 0,
                reasoning: '',
                sources: [],
                suggestions: ['funclib index çalıştırın'],
            };
        }
        let codeToAnalyze = '';
        if (filePath) {
            const fullPath = path.isAbsolute(filePath)
                ? filePath
                : path.join(this.projectPath, filePath);
            if (fs.existsSync(fullPath)) {
                codeToAnalyze = fs.readFileSync(fullPath, 'utf-8');
            }
        }
        else {
            // En çok değişen dosyaları analiz et (hotspots)
            const hotspots = this.graph.findHotspots(5);
            for (const { node } of hotspots) {
                if (node.file) {
                    const fullPath = path.join(this.projectPath, node.file);
                    if (fs.existsSync(fullPath)) {
                        codeToAnalyze += `\n// ${node.file}\n`;
                        codeToAnalyze += fs.readFileSync(fullPath, 'utf-8').slice(0, 500);
                    }
                }
            }
        }
        if (!codeToAnalyze) {
            return {
                answer: 'Analiz edilecek kod bulunamadı.',
                confidence: 0,
                reasoning: '',
                sources: [],
                suggestions: ['Bir dosya yolu belirtin'],
            };
        }
        return this.reasoning.predictBugs(codeToAnalyze);
    }
    /**
     * Değişiklik etkisi analizi
     */
    async analyzeChange(symbolName) {
        const usages = await this.findUsages(symbolName);
        if (usages.relevantCode.length === 0) {
            return {
                answer: `"${symbolName}" bulunamadı.`,
                relevantCode: [],
                suggestions: [],
                confidence: 0,
            };
        }
        // Graph'tan impact al
        const nodeId = `${usages.relevantCode[0].file}:${symbolName}`;
        const impact = this.graph.findImpact(nodeId);
        // Risk seviyesi hesapla
        let riskLevel = 'düşük';
        if (usages.relevantCode.length > 20)
            riskLevel = 'kritik';
        else if (usages.relevantCode.length > 10)
            riskLevel = 'yüksek';
        else if (usages.relevantCode.length > 5)
            riskLevel = 'orta';
        const answer = `⚠️ **${symbolName}** Etki Analizi

📊 Risk Seviyesi: **${riskLevel.toUpperCase()}**

📁 Doğrudan etkilenen: ${usages.relevantCode.length} dosya
🔗 Dolaylı etkilenen: ${impact.transitiveNodes.length} sembol

${usages.relevantCode.slice(0, 10).map(r => `  • ${r.file}:${r.line}`).join('\n')}

${usages.relevantCode.length > 10 ? `  ... ve ${usages.relevantCode.length - 10} dosya daha` : ''}`;
        return {
            answer,
            relevantCode: usages.relevantCode,
            suggestions: [
                riskLevel === 'kritik' ? 'Feature flag arkasına alın' : '',
                usages.relevantCode.length > 10 ? 'Incremental migration yapın' : '',
                'Önce test yazın',
            ].filter(Boolean),
            confidence: 0.85,
            impact,
        };
    }
    /**
     * Vector store'u index ile doldur
     */
    async buildVectorIndex() {
        const index = this.indexManager.getIndex();
        if (!index) {
            console.log('❌ Index bulunamadı. Önce `funclib index` çalıştırın.');
            return;
        }
        console.log('🧠 Vector index oluşturuluyor...');
        const docs = [];
        for (const [file, data] of Object.entries(index.files)) {
            const fileData = data;
            for (const symbol of fileData.symbols) {
                // Her symbol için döküman oluştur
                let content = `${symbol.kind} ${symbol.name}`;
                // Kod snippet'i ekle
                try {
                    const filePath = path.join(this.projectPath, file);
                    if (fs.existsSync(filePath)) {
                        const fileContent = fs.readFileSync(filePath, 'utf-8');
                        const lines = fileContent.split('\n');
                        const startLine = Math.max(0, symbol.range.start.line - 1);
                        const endLine = Math.min(lines.length, symbol.range.start.line + 5);
                        content += '\n' + lines.slice(startLine, endLine).join('\n');
                    }
                }
                catch (e) {
                    // Ignore
                }
                docs.push({
                    id: `${file}:${symbol.name}:${symbol.range.start.line}`,
                    content: content.slice(0, 500),
                    metadata: {
                        file,
                        line: symbol.range.start.line,
                        kind: symbol.kind,
                        name: symbol.name,
                    },
                });
            }
        }
        if (docs.length > 0) {
            await this.vectorStore.addBatch(docs);
            console.log(`✅ ${docs.length} döküman vektörize edildi`);
        }
    }
    /**
     * Knowledge graph'ı index ile doldur
     */
    buildKnowledgeGraph() {
        const index = this.indexManager.getIndex();
        if (!index) {
            console.log('❌ Index bulunamadı.');
            return;
        }
        console.log('🕸️ Knowledge graph oluşturuluyor...');
        this.graph.clear();
        // Dosyaları ve sembolleri node olarak ekle
        for (const [file, data] of Object.entries(index.files)) {
            const fileData = data;
            // File node
            this.graph.addNode({
                id: file,
                type: 'File',
                name: path.basename(file),
                file,
                properties: {},
            });
            // Symbol nodes
            for (const symbol of fileData.symbols) {
                const nodeId = `${file}:${symbol.name}`;
                let nodeType = 'Function';
                if (symbol.kind === 'class')
                    nodeType = 'Class';
                else if (symbol.kind === 'interface')
                    nodeType = 'Interface';
                else if (symbol.kind === 'type')
                    nodeType = 'Type';
                else if (symbol.kind === 'hook')
                    nodeType = 'Composable';
                else if (symbol.kind === 'component')
                    nodeType = 'Component';
                this.graph.addNode({
                    id: nodeId,
                    type: nodeType,
                    name: symbol.name,
                    file,
                    line: symbol.range.start.line,
                    properties: { kind: symbol.kind },
                });
                // File -> Symbol edge
                this.graph.addEdge({
                    id: `${file}->contains->${nodeId}`,
                    type: 'CONTAINS',
                    source: file,
                    target: nodeId,
                    properties: {},
                });
            }
            // Reference edges
            for (const ref of fileData.references) {
                const targetNodeId = this.findSymbolNodeId(index, ref.symbol);
                if (targetNodeId) {
                    const sourceNodeId = `${file}:${ref.symbol}`;
                    this.graph.addEdge({
                        id: `${file}:${ref.range.start.line}->uses->${targetNodeId}`,
                        type: 'USES',
                        source: file,
                        target: targetNodeId,
                        properties: { line: ref.range.start.line },
                    });
                }
            }
            // Import edges
            for (const imp of fileData.imports) {
                this.graph.addEdge({
                    id: `${file}->imports->${imp.source}`,
                    type: 'IMPORTS',
                    source: file,
                    target: imp.source,
                    properties: { specifiers: imp.specifiers.map(s => s.name) },
                });
            }
        }
        this.graph.save();
        const stats = this.graph.getStats();
        console.log(`✅ Graph oluşturuldu: ${stats.nodeCount} node, ${stats.edgeCount} edge`);
    }
    findSymbolNodeId(index, symbolName) {
        for (const [file, data] of Object.entries(index.files)) {
            for (const symbol of data.symbols) {
                if (symbol.name === symbolName) {
                    return `${file}:${symbol.name}`;
                }
            }
        }
        return null;
    }
    /**
     * Sistemin hazır olup olmadığını kontrol et
     */
    async checkReady() {
        const index = this.indexManager.getIndex();
        const health = await this.reasoning.checkHealth();
        const graphStats = this.graph.getStats();
        let symbolCount = 0;
        if (index) {
            for (const data of Object.values(index.files)) {
                const fileData = data;
                symbolCount += fileData.symbols.length;
            }
        }
        return {
            indexReady: !!index,
            vectorReady: this.vectorStore.size > 0,
            graphReady: graphStats.nodeCount > 0,
            llmReady: health.available,
            symbolCount,
            vectorCount: this.vectorStore.size,
            nodeCount: graphStats.nodeCount,
        };
    }
}
exports.QueryEngine = QueryEngine;
exports.default = QueryEngine;
//# sourceMappingURL=queryEngine.js.map