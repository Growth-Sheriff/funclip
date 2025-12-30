"use strict";
/**
 * FuncLib v4 - MCP (Model Context Protocol) Server
 *
 * Bu sunucu Copilot, Claude ve diğer AI araçlarının
 * FuncLib'i doğrudan tool olarak kullanmasını sağlar.
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
exports.TOOLS = void 0;
exports.createMCPServer = createMCPServer;
exports.executeTool = executeTool;
const http = __importStar(require("http"));
const indexManager_1 = __importDefault(require("./indexManager"));
const queryEngine_1 = require("./output/queryEngine");
const PROJECT_PATH = process.env.FUNCLIB_PROJECT || process.cwd();
const indexManager = new indexManager_1.default(PROJECT_PATH);
indexManager.load();
// MCP Tool definitions
const TOOLS = {
    search_symbols: {
        name: 'search_symbols',
        description: 'Search for functions, classes, methods, and other symbols in the codebase. Use this to find where something is defined.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query (symbol name or pattern)',
                },
                kind: {
                    type: 'string',
                    enum: ['function', 'method', 'class', 'interface', 'type', 'enum', 'variable'],
                    description: 'Filter by symbol kind',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum results to return (default: 20)',
                },
            },
            required: ['query'],
        },
    },
    find_references: {
        name: 'find_references',
        description: 'Find ALL places where a symbol is used (called, imported, instantiated). CRITICAL: Always use this before modifying a function to find all usages that need updating.',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Exact symbol name to find references for',
                },
            },
            required: ['name'],
        },
    },
    get_symbol: {
        name: 'get_symbol',
        description: 'Get detailed information about a specific symbol including its signature, parameters, and location.',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Exact symbol name',
                },
            },
            required: ['name'],
        },
    },
    list_symbols_in_file: {
        name: 'list_symbols_in_file',
        description: 'List all symbols (functions, classes, etc.) defined in a specific file.',
        inputSchema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    description: 'File path (relative to project root)',
                },
            },
            required: ['file'],
        },
    },
    index_project: {
        name: 'index_project',
        description: 'Re-index the project to update symbol database. Use after making changes to the codebase.',
        inputSchema: {
            type: 'object',
            properties: {
                incremental: {
                    type: 'boolean',
                    description: 'Only index changed files (default: true)',
                },
            },
        },
    },
    get_call_graph: {
        name: 'get_call_graph',
        description: 'Get the call graph showing which functions call which other functions.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    // ============ AI TOOLS (v4) ============
    semantic_search: {
        name: 'semantic_search',
        description: 'Search code using natural language. Uses AI embeddings for semantic understanding. Good for questions like "where is user authentication handled?" or "find functions related to payment".',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Natural language query to search for',
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum results to return (default: 10)',
                },
            },
            required: ['query'],
        },
    },
    analyze_impact: {
        name: 'analyze_impact',
        description: 'Analyze the impact of changing a function or class. Shows all files that would be affected and risk level. CRITICAL: Use this before making breaking changes.',
        inputSchema: {
            type: 'object',
            properties: {
                symbol: {
                    type: 'string',
                    description: 'Name of the function, class, or symbol to analyze',
                },
            },
            required: ['symbol'],
        },
    },
    build_ai_index: {
        name: 'build_ai_index',
        description: 'Build the AI index (vector embeddings and knowledge graph). Run this after major code changes to update semantic search.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    get_ai_status: {
        name: 'get_ai_status',
        description: 'Check the status of AI features (vector store, knowledge graph, LLM connectivity).',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
};
exports.TOOLS = TOOLS;
// Tool execution
async function executeTool(name, args) {
    switch (name) {
        case 'search_symbols': {
            const results = indexManager.search({
                query: args.query,
                kind: args.kind,
                limit: args.limit || 20,
            });
            return results.map(r => ({
                name: r.symbol.name,
                kind: r.symbol.kind,
                file: r.symbol.file,
                line: r.symbol.range.start.line,
                signature: r.symbol.signature,
                exported: r.symbol.exported,
                score: r.score,
            }));
        }
        case 'find_references': {
            const refs = indexManager.findReferences(args.name);
            return {
                symbol: args.name,
                definitionCount: refs.definitions.length,
                referenceCount: refs.references.length,
                definitions: refs.definitions.map(d => ({
                    file: d.file,
                    line: d.range.start.line,
                    signature: d.signature,
                })),
                references: refs.references.map(r => ({
                    file: r.file,
                    line: r.range.start.line,
                    context: r.context,
                    kind: r.kind,
                })),
            };
        }
        case 'get_symbol': {
            const defs = indexManager.getAllDefinitions(args.name);
            if (defs.length === 0) {
                return { error: `Symbol not found: ${args.name}` };
            }
            return {
                name: args.name,
                definitions: defs.map(d => ({
                    kind: d.kind,
                    file: d.file,
                    line: d.range.start.line,
                    signature: d.signature,
                    exported: d.exported,
                    async: d.async,
                    parameters: d.parameters,
                    language: d.language,
                })),
            };
        }
        case 'list_symbols_in_file': {
            const symbols = indexManager.getSymbolsInFile(args.file);
            return {
                file: args.file,
                symbols: symbols.map(s => ({
                    name: s.name,
                    kind: s.kind,
                    line: s.range.start.line,
                    signature: s.signature,
                })),
            };
        }
        case 'index_project': {
            const result = await indexManager.indexProject({
                incremental: args.incremental !== false,
            });
            return {
                indexed: result.indexed,
                skipped: result.skipped,
                errors: result.errors.length,
                stats: indexManager.getStats(),
            };
        }
        case 'get_call_graph': {
            const graph = indexManager.buildCallGraph();
            return {
                nodeCount: graph.nodes.length,
                edgeCount: graph.edges.length,
                edges: graph.edges.slice(0, 100).map(e => ({
                    from: e.from,
                    to: e.to,
                    count: e.count,
                })),
            };
        }
        // ============ AI TOOLS (v4) ============
        case 'semantic_search': {
            const queryEngine = new queryEngine_1.QueryEngine(PROJECT_PATH);
            const result = await queryEngine.ask(args.query, {
                useLLM: false,
                maxResults: args.maxResults || 10,
                includeCode: true,
            });
            return {
                query: args.query,
                answer: result.answer,
                confidence: result.confidence,
                results: result.relevantCode.map(r => ({
                    name: r.name,
                    kind: r.kind,
                    file: r.file,
                    line: r.line,
                    similarity: r.similarity,
                })),
                suggestions: result.suggestions,
            };
        }
        case 'analyze_impact': {
            const queryEngine = new queryEngine_1.QueryEngine(PROJECT_PATH);
            const result = await queryEngine.analyzeChange(args.symbol);
            return {
                symbol: args.symbol,
                answer: result.answer,
                confidence: result.confidence,
                affectedFiles: result.relevantCode.length,
                files: result.relevantCode.map(r => ({
                    file: r.file,
                    line: r.line,
                    kind: r.kind,
                })),
                suggestions: result.suggestions,
                impact: result.impact,
            };
        }
        case 'build_ai_index': {
            const queryEngine = new queryEngine_1.QueryEngine(PROJECT_PATH);
            const ready = await queryEngine.checkReady();
            if (!ready.indexReady) {
                return { error: 'AST index not found. Run index_project first.' };
            }
            queryEngine.buildKnowledgeGraph();
            await queryEngine.buildVectorIndex();
            const newStatus = await queryEngine.checkReady();
            return {
                success: true,
                vectorCount: newStatus.vectorCount,
                nodeCount: newStatus.nodeCount,
            };
        }
        case 'get_ai_status': {
            const queryEngine = new queryEngine_1.QueryEngine(PROJECT_PATH);
            const ready = await queryEngine.checkReady();
            return {
                astIndex: ready.indexReady,
                vectorStore: ready.vectorReady,
                knowledgeGraph: ready.graphReady,
                llm: ready.llmReady,
                symbolCount: ready.symbolCount,
                vectorCount: ready.vectorCount,
                nodeCount: ready.nodeCount,
            };
        }
        default:
            return { error: `Unknown tool: ${name}` };
    }
}
// MCP Protocol handlers
function handleListTools() {
    return {
        tools: Object.values(TOOLS),
    };
}
async function handleCallTool(params) {
    const result = await executeTool(params.name, params.arguments || {});
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(result, null, 2),
            },
        ],
    };
}
// HTTP Server for MCP
function createMCPServer(port) {
    const server = http.createServer(async (req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        if (req.method !== 'POST') {
            res.writeHead(405);
            res.end('Method not allowed');
            return;
        }
        // Parse body
        let body = '';
        for await (const chunk of req) {
            body += chunk;
        }
        try {
            const request = JSON.parse(body);
            let response;
            switch (request.method) {
                case 'tools/list':
                    response = handleListTools();
                    break;
                case 'tools/call':
                    response = await handleCallTool(request.params);
                    break;
                case 'initialize':
                    response = {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {},
                        },
                        serverInfo: {
                            name: 'funclib',
                            version: '4.0.0',
                        },
                    };
                    break;
                default:
                    response = { error: `Unknown method: ${request.method}` };
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                result: response,
            }));
        }
        catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                    code: -32700,
                    message: err.message || 'Parse error',
                },
            }));
        }
    });
    server.listen(port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              FuncLib v4 - MCP Server (AI-Powered)             ║
╠═══════════════════════════════════════════════════════════════╣
║  Port: ${String(port).padEnd(53)}║
║  Project: ${PROJECT_PATH.substring(0, 49).padEnd(49)}║
╚═══════════════════════════════════════════════════════════════╝

Core Tools:
  • search_symbols      - Search for symbols
  • find_references     - Find all usages of a symbol
  • get_symbol          - Get symbol details
  • list_symbols_in_file - List symbols in a file
  • index_project       - Re-index the project
  • get_call_graph      - Get function call graph

AI Tools (v4):
  • semantic_search     - Natural language code search
  • analyze_impact      - Change impact analysis
  • build_ai_index      - Build AI indexes
  • get_ai_status       - Check AI status

MCP Endpoint: http://localhost:${port}

Add to your MCP configuration:
{
  "mcpServers": {
    "funclib": {
      "url": "http://localhost:${port}"
    }
  }
}
`);
    });
    return server;
}
// Start if run directly
if (require.main === module) {
    const port = parseInt(process.env.MCP_PORT || '3457');
    createMCPServer(port);
}
//# sourceMappingURL=mcp.js.map