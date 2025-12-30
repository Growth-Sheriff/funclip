"use strict";
/**
 * FuncLib v4 - REST API Server
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const indexManager_1 = __importDefault(require("./indexManager"));
const queryEngine_1 = require("./output/queryEngine");
const logger_1 = require("./core/logger");
const logger = (0, logger_1.getLogger)().child('Server');
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Project path from env or cwd
const PROJECT_PATH = process.env.FUNCLIB_PROJECT || process.cwd();
const indexManager = new indexManager_1.default(PROJECT_PATH);
// Load existing index
indexManager.load();
// ========================
// Middleware
// ========================
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const timing = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', `${duration}ms`);
    });
    next();
};
app.use(timing);
// ========================
// Routes
// ========================
/**
 * GET /health - Health check
 */
app.get('/health', (req, res) => {
    const stats = indexManager.getStats();
    res.json({
        status: 'ok',
        project: PROJECT_PATH,
        indexed: stats.totalFiles > 0,
        stats: {
            files: stats.totalFiles,
            symbols: stats.totalSymbols,
            references: stats.totalReferences,
        },
    });
});
/**
 * POST /index - Index the project
 */
app.post('/index', asyncHandler(async (req, res) => {
    const incremental = req.body.incremental !== false;
    const result = await indexManager.indexProject({ incremental });
    res.json({
        success: true,
        ...result,
        stats: indexManager.getStats(),
    });
}));
/**
 * POST /index/file - Index a single file
 */
app.post('/index/file', asyncHandler(async (req, res) => {
    const { file } = req.body;
    if (!file) {
        return res.status(400).json({ error: 'file is required' });
    }
    const result = await indexManager.indexFile(file);
    if (result) {
        res.json({
            success: true,
            file: result.file,
            symbols: result.symbols.length,
            references: result.references.length,
        });
    }
    else {
        res.status(400).json({ error: 'Failed to index file' });
    }
}));
/**
 * GET /search - Search symbols
 */
app.get('/search', (req, res) => {
    const query = String(req.query.q || '');
    if (!query) {
        return res.status(400).json({ error: 'Query required (?q=...)' });
    }
    const options = {
        query,
        kind: req.query.kind,
        language: req.query.language,
        file: req.query.file,
        exported: req.query.exported === 'true' ? true :
            req.query.exported === 'false' ? false : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit)) : 50,
        fuzzy: req.query.fuzzy !== 'false',
        regex: req.query.regex === 'true',
    };
    const results = indexManager.search(options);
    res.json({
        query,
        count: results.length,
        results: results.map(r => ({
            name: r.symbol.name,
            kind: r.symbol.kind,
            file: r.symbol.file,
            line: r.symbol.range.start.line,
            column: r.symbol.range.start.column,
            signature: r.symbol.signature,
            exported: r.symbol.exported,
            async: r.symbol.async,
            language: r.symbol.language,
            score: r.score,
        })),
    });
});
/**
 * GET /symbol/:name - Get symbol details
 */
app.get('/symbol/:name', (req, res) => {
    const name = req.params.name;
    const definitions = indexManager.getAllDefinitions(name);
    if (definitions.length === 0) {
        return res.status(404).json({ error: `Symbol not found: ${name}` });
    }
    res.json({
        name,
        definitionCount: definitions.length,
        definitions: definitions.map(d => ({
            kind: d.kind,
            file: d.file,
            line: d.range.start.line,
            column: d.range.start.column,
            endLine: d.range.end.line,
            signature: d.signature,
            exported: d.exported,
            async: d.async,
            static: d.static,
            visibility: d.visibility,
            parameters: d.parameters,
            returnType: d.returnType,
            parent: d.parent,
            language: d.language,
        })),
    });
});
/**
 * GET /refs/:name - Find all references
 */
app.get('/refs/:name', (req, res) => {
    const name = req.params.name;
    const result = indexManager.findReferences(name);
    res.json({
        symbol: name,
        definitionCount: result.definitions.length,
        referenceCount: result.references.length,
        total: result.total,
        definitions: result.definitions.map(d => ({
            file: d.file,
            line: d.range.start.line,
            kind: d.kind,
            signature: d.signature,
        })),
        references: result.references.map(r => ({
            file: r.file,
            line: r.range.start.line,
            column: r.range.start.column,
            kind: r.kind,
            context: r.context,
        })),
    });
});
/**
 * GET /file/* - Get symbols in a file
 */
app.get('/file/*', (req, res) => {
    const filePath = req.params[0];
    const symbols = indexManager.getSymbolsInFile(filePath);
    res.json({
        file: filePath,
        count: symbols.length,
        symbols: symbols.map(s => ({
            name: s.name,
            kind: s.kind,
            line: s.range.start.line,
            signature: s.signature,
            exported: s.exported,
        })),
    });
});
/**
 * GET /stats - Index statistics
 */
app.get('/stats', (req, res) => {
    const stats = indexManager.getStats();
    res.json({
        ...stats,
        project: PROJECT_PATH,
    });
});
/**
 * GET /all - All symbols grouped by file
 */
app.get('/all', (req, res) => {
    const symbols = indexManager.getAllSymbols();
    const grouped = {};
    for (const s of symbols) {
        if (!grouped[s.file])
            grouped[s.file] = [];
        grouped[s.file].push({
            name: s.name,
            kind: s.kind,
            line: s.range.start.line,
            signature: s.signature,
        });
    }
    res.json({
        totalFiles: Object.keys(grouped).length,
        totalSymbols: symbols.length,
        files: grouped,
    });
});
/**
 * GET /graph - Call graph
 */
app.get('/graph', (req, res) => {
    const graph = indexManager.buildCallGraph();
    res.json(graph);
});
// ========================
// AI Endpoints (v4)
// ========================
/**
 * GET /ai/status - AI status check
 */
app.get('/ai/status', asyncHandler(async (req, res) => {
    const queryEngine = new queryEngine_1.QueryEngine(PROJECT_PATH);
    const ready = await queryEngine.checkReady();
    res.json({
        astIndex: ready.indexReady,
        vectorStore: ready.vectorReady,
        knowledgeGraph: ready.graphReady,
        llm: ready.llmReady,
        symbolCount: ready.symbolCount,
        vectorCount: ready.vectorCount,
        nodeCount: ready.nodeCount,
    });
}));
/**
 * POST /ai/ask - Semantic code search
 */
app.post('/ai/ask', asyncHandler(async (req, res) => {
    const { query, maxResults = 10, useLLM = true } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'query is required' });
    }
    const queryEngine = new queryEngine_1.QueryEngine(PROJECT_PATH);
    const result = await queryEngine.ask(query, {
        useLLM,
        maxResults,
        includeCode: true,
    });
    res.json({
        query,
        answer: result.answer,
        confidence: result.confidence,
        results: result.relevantCode,
        suggestions: result.suggestions,
    });
}));
/**
 * GET /ai/impact/:symbol - Change impact analysis
 */
app.get('/ai/impact/:symbol', asyncHandler(async (req, res) => {
    const symbol = req.params.symbol;
    const queryEngine = new queryEngine_1.QueryEngine(PROJECT_PATH);
    const result = await queryEngine.analyzeChange(symbol);
    res.json({
        symbol,
        answer: result.answer,
        confidence: result.confidence,
        affectedFiles: result.relevantCode.length,
        files: result.relevantCode,
        suggestions: result.suggestions,
        impact: result.impact,
    });
}));
/**
 * POST /ai/build - Build AI index
 */
app.post('/ai/build', asyncHandler(async (req, res) => {
    const queryEngine = new queryEngine_1.QueryEngine(PROJECT_PATH);
    const ready = await queryEngine.checkReady();
    if (!ready.indexReady) {
        return res.status(400).json({ error: 'AST index not found. Run POST /index first.' });
    }
    queryEngine.buildKnowledgeGraph();
    await queryEngine.buildVectorIndex();
    const newStatus = await queryEngine.checkReady();
    res.json({
        success: true,
        vectorCount: newStatus.vectorCount,
        nodeCount: newStatus.nodeCount,
    });
}));
// ========================
// AI Endpoints (v4.1)
// ========================
/**
 * POST /ai/bugs - Predict bugs
 */
app.post('/ai/bugs', asyncHandler(async (req, res) => {
    const { symbol, file } = req.body;
    const { getBugPredictor } = await Promise.resolve().then(() => __importStar(require('./output/bugPredictor')));
    const predictor = getBugPredictor();
    if (symbol) {
        const defs = indexManager.getAllDefinitions(symbol);
        if (defs.length === 0) {
            return res.status(404).json({ error: `Symbol not found: ${symbol}` });
        }
        const predictions = predictor.predictBugs(defs[0]);
        return res.json({
            symbol,
            predictions: predictions.slice(0, 15),
        });
    }
    if (file) {
        const symbols = indexManager.getSymbolsInFile(file);
        const allPredictions = [];
        for (const sym of symbols.slice(0, 30)) {
            const preds = predictor.predictBugs(sym);
            allPredictions.push(...preds);
        }
        return res.json({
            file,
            predictions: allPredictions
                .sort((a, b) => b.score - a.score)
                .slice(0, 20),
        });
    }
    res.status(400).json({ error: 'Either symbol or file is required' });
}));
/**
 * POST /ai/context - Get Copilot context
 */
app.post('/ai/context', asyncHandler(async (req, res) => {
    const { file } = req.body;
    if (!file) {
        return res.status(400).json({ error: 'file is required' });
    }
    const { getCopilotGuide } = await Promise.resolve().then(() => __importStar(require('./output/copilotGuide')));
    const guide = getCopilotGuide();
    const context = guide.prepareContext(file);
    res.json({
        file,
        relatedSymbols: context.relatedSymbols.slice(0, 15),
        patterns: context.patterns.slice(0, 10),
        warnings: context.warnings,
    });
}));
/**
 * POST /ai/evaluate - Evaluate suggestion
 */
app.post('/ai/evaluate', asyncHandler(async (req, res) => {
    const { suggestion, file } = req.body;
    if (!suggestion || !file) {
        return res.status(400).json({ error: 'suggestion and file are required' });
    }
    const { getCopilotGuide } = await Promise.resolve().then(() => __importStar(require('./output/copilotGuide')));
    const guide = getCopilotGuide();
    const context = guide.prepareContext(file);
    const evaluation = guide.evaluateSuggestion(suggestion, context);
    res.json({
        score: evaluation.score,
        accepted: evaluation.accepted,
        reasons: evaluation.reasons,
        warnings: evaluation.warnings,
        alternatives: evaluation.alternatives,
    });
}));
/**
 * GET /ai/patterns - Get cross-project patterns
 */
app.get('/ai/patterns', asyncHandler(async (req, res) => {
    const category = req.query.category;
    const limit = parseInt(String(req.query.limit)) || 15;
    const { getCrossProjectKB } = await Promise.resolve().then(() => __importStar(require('./memory/crossProjectKB')));
    const kb = getCrossProjectKB();
    const patterns = kb.getMostUsedPatterns(undefined, limit);
    res.json({
        patterns: patterns
            .filter(p => !category || p.category === category)
            .map(p => ({
            name: p.name,
            category: p.category,
            description: p.description,
            frequency: p.frequency,
            confidence: p.confidence,
            code: p.code,
        })),
    });
}));
/**
 * GET /ai/learn - Get learning stats
 */
app.get('/ai/learn', asyncHandler(async (req, res) => {
    const { getSelfLearning } = await Promise.resolve().then(() => __importStar(require('./reasoning/selfLearning')));
    const learning = getSelfLearning();
    const stats = learning.getStats();
    const copilotStats = learning.getCopilotAcceptanceRate();
    const stabilityScore = learning.getCommitStabilityScore();
    res.json({
        totalFeedbacks: stats.totalFeedbacks,
        acceptanceRate: stats.acceptanceRate,
        avgReward: stats.avgReward,
        learningVelocity: stats.learningVelocity,
        copilotAcceptance: copilotStats.overall,
        commitStability: stabilityScore,
        topPatterns: stats.topPatterns.slice(0, 15),
    });
}));
/**
 * GET /ai/hotspots - Find code hotspots
 */
app.get('/ai/hotspots', asyncHandler(async (req, res) => {
    const limit = parseInt(String(req.query.limit)) || 15;
    const { getBugPredictor } = await Promise.resolve().then(() => __importStar(require('./output/bugPredictor')));
    const predictor = getBugPredictor();
    const symbols = indexManager.getAllSymbols();
    const files = [...new Set(symbols.map(s => s.file))];
    const hotspots = predictor.findHotspots(files, limit);
    res.json({
        hotspots,
    });
}));
/**
 * GET /ai/llm-status - Check LLM providers status
 */
app.get('/ai/llm-status', asyncHandler(async (req, res) => {
    const { LLMClient } = await Promise.resolve().then(() => __importStar(require('./reasoning/llmClient')));
    const { getMultiModelEnsemble } = await Promise.resolve().then(() => __importStar(require('./reasoning/multiModel')));
    const ollamaClient = new LLMClient({ provider: 'ollama', model: 'llama3.2', baseUrl: 'http://localhost:11434' });
    const ollamaOk = await ollamaClient.checkOllama();
    const ensemble = getMultiModelEnsemble();
    res.json({
        ollama: ollamaOk,
        groq: !!process.env.GROQ_API_KEY,
        together: !!process.env.TOGETHER_API_KEY,
        registeredModels: ensemble.getModels().map(m => ({
            name: m.name,
            provider: m.provider,
            model: m.model,
        })),
    });
}));
/**
 * POST /ai/multi-ask - Multi-model query
 */
app.post('/ai/multi-ask', asyncHandler(async (req, res) => {
    const { question, systemPrompt } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'question is required' });
    }
    const { getMultiModelEnsemble } = await Promise.resolve().then(() => __importStar(require('./reasoning/multiModel')));
    const { LLMClient } = await Promise.resolve().then(() => __importStar(require('./reasoning/llmClient')));
    const ensemble = getMultiModelEnsemble();
    // Auto-add models if none registered
    if (ensemble.getModels().length === 0) {
        const ollamaClient = new LLMClient({ provider: 'ollama', model: 'llama3.2', baseUrl: 'http://localhost:11434' });
        const ollamaOk = await ollamaClient.checkOllama();
        if (ollamaOk) {
            ensemble.addModel({
                name: 'ollama-codellama',
                provider: 'ollama',
                model: 'llama3.2',
                baseUrl: 'http://localhost:11434',
                priority: 1,
                specialties: ['code', 'debugging'],
            });
        }
        if (process.env.GROQ_API_KEY) {
            ensemble.addModel({
                name: 'groq-llama',
                provider: 'groq',
                model: 'llama-3.2-70b-versatile',
                baseUrl: 'https://api.groq.com/openai/v1',
                apiKey: process.env.GROQ_API_KEY,
                priority: 2,
                specialties: ['general', 'documentation'],
            });
        }
    }
    if (ensemble.getModels().length === 0) {
        return res.status(503).json({ error: 'No LLM providers available' });
    }
    const result = await ensemble.query(question, systemPrompt);
    res.json({
        response: result.response,
        model: result.model,
        confidence: result.confidence,
        alternatives: result.alternatives.length,
        totalTime: result.metadata.totalTime,
        tokensUsed: result.metadata.tokensUsed,
    });
}));
/**
 * POST /ai/mesh - Mesh consensus query
 */
app.post('/ai/mesh', asyncHandler(async (req, res) => {
    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'question is required' });
    }
    const { getMeshEngine } = await Promise.resolve().then(() => __importStar(require('./reasoning/meshEngine')));
    const { LLMClient } = await Promise.resolve().then(() => __importStar(require('./reasoning/llmClient')));
    const outputs = [];
    // Query Ollama
    const ollamaClient = new LLMClient({ provider: 'ollama', model: 'llama3.2', baseUrl: 'http://localhost:11434' });
    const ollamaOk = await ollamaClient.checkOllama();
    if (ollamaOk) {
        const start = Date.now();
        try {
            const resp = await ollamaClient.chat([
                { role: 'system', content: 'You are a helpful programming assistant.' },
                { role: 'user', content: question }
            ]);
            outputs.push({
                model: 'ollama-codellama',
                response: resp.content,
                confidence: 0.8,
                latency: Date.now() - start,
                tokens: { prompt: resp.usage?.promptTokens || 0, completion: resp.usage?.completionTokens || 0 }
            });
        }
        catch (e) {
            // Ignore error
        }
    }
    // Query Groq if available
    if (process.env.GROQ_API_KEY) {
        const groqClient = new LLMClient({
            provider: 'groq',
            model: 'llama-3.2-70b-versatile',
            baseUrl: 'https://api.groq.com/openai/v1',
            apiKey: process.env.GROQ_API_KEY
        });
        const start = Date.now();
        try {
            const resp = await groqClient.chat([
                { role: 'system', content: 'You are a helpful programming assistant.' },
                { role: 'user', content: question }
            ]);
            outputs.push({
                model: 'groq-llama',
                response: resp.content,
                confidence: 0.85,
                latency: Date.now() - start,
                tokens: { prompt: resp.usage?.promptTokens || 0, completion: resp.usage?.completionTokens || 0 }
            });
        }
        catch (e) {
            // Ignore error
        }
    }
    if (outputs.length === 0) {
        return res.status(503).json({ error: 'No LLM providers responded' });
    }
    const meshEngine = getMeshEngine();
    const meshed = meshEngine.meshModelOutputs(outputs);
    res.json({
        synthesized: meshed.synthesized,
        confidence: meshed.confidence,
        sources: meshed.sources,
        agreements: meshed.agreements.length,
        conflicts: meshed.conflicts.length,
        reasoning: meshed.reasoning,
    });
}));
/**
 * POST /copilot - Copilot-friendly endpoint
 */
app.post('/copilot', (req, res) => {
    const { action, name, query } = req.body;
    switch (action) {
        case 'search': {
            const results = indexManager.search({ query: query || name, limit: 20 });
            const output = results.map(r => `${r.symbol.file}:${r.symbol.range.start.line} [${r.symbol.kind}] ${r.symbol.signature || r.symbol.name}`).join('\n');
            res.type('text/plain').send(output || 'No results found');
            break;
        }
        case 'refs': {
            const refs = indexManager.findReferences(name);
            let output = '';
            if (refs.definitions.length > 0) {
                output += '=== DEFINITIONS ===\n';
                output += refs.definitions.map(d => `${d.file}:${d.range.start.line} - ${d.signature || d.name}`).join('\n');
                output += '\n\n';
            }
            if (refs.references.length > 0) {
                output += '=== REFERENCES ===\n';
                output += refs.references.map(r => `${r.file}:${r.range.start.line} - ${r.context}`).join('\n');
            }
            res.type('text/plain').send(output || `No references found for: ${name}`);
            break;
        }
        case 'definition':
        case 'symbol': {
            const defs = indexManager.getAllDefinitions(name);
            if (defs.length === 0) {
                res.type('text/plain').send(`Symbol not found: ${name}`);
                break;
            }
            const output = defs.map(d => `=== ${d.file}:${d.range.start.line} ===\nKind: ${d.kind}\nSignature: ${d.signature}\nExported: ${d.exported ? 'yes' : 'no'}`).join('\n\n');
            res.type('text/plain').send(output);
            break;
        }
        default:
            res.status(400).type('text/plain').send('Actions: search, refs, definition\n' +
                'Example: {"action": "refs", "name": "handleSubmit"}');
    }
});
// Error handler
app.use((err, req, res, next) => {
    logger.error('API Error:', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message || 'Internal server error' });
});
// Start server
const PORT = process.env.PORT || 3456;
function startServer() {
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              FuncLib v4 - Universal Symbol Index              ║
╠═══════════════════════════════════════════════════════════════╣
║  Port: ${String(PORT).padEnd(53)}║
║  Project: ${PROJECT_PATH.substring(0, 49).padEnd(49)}║
╚═══════════════════════════════════════════════════════════════╝

Core Endpoints:
  POST /index          - Index project
  GET  /search?q=...   - Search symbols
  GET  /symbol/:name   - Symbol details
  GET  /refs/:name     - Find all references
  POST /copilot        - Copilot endpoint

AI Endpoints (v4):
  GET  /ai/status      - AI system status
  POST /ai/ask         - Semantic code search
  GET  /ai/impact/:sym - Change impact analysis
  POST /ai/build       - Build AI indexes

AI Endpoints (v4.1):
  POST /ai/bugs        - Predict potential bugs
  POST /ai/context     - Get Copilot context
  POST /ai/evaluate    - Evaluate suggestions
  GET  /ai/patterns    - Cross-project patterns
  GET  /ai/learn       - Learning statistics
  GET  /ai/hotspots    - Code hotspots

AI Endpoints (v4.2 - Multi-Model):
  GET  /ai/llm-status  - LLM providers status
  POST /ai/multi-ask   - Multi-model query
  POST /ai/mesh        - Mesh consensus query

Supported: JS, TS, Python, Go, Rust, Java, C#, PHP, Ruby, Swift...
`);
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map