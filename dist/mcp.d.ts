/**
 * FuncLib v4 - MCP (Model Context Protocol) Server
 *
 * Bu sunucu Copilot, Claude ve diğer AI araçlarının
 * FuncLib'i doğrudan tool olarak kullanmasını sağlar.
 */
import * as http from 'http';
declare const TOOLS: {
    search_symbols: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                query: {
                    type: string;
                    description: string;
                };
                kind: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                limit: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    find_references: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                name: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    get_symbol: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                name: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    list_symbols_in_file: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                file: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    index_project: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                incremental: {
                    type: string;
                    description: string;
                };
            };
        };
    };
    get_call_graph: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {};
        };
    };
    semantic_search: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                query: {
                    type: string;
                    description: string;
                };
                maxResults: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    analyze_impact: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                symbol: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    build_ai_index: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {};
        };
    };
    get_ai_status: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {};
        };
    };
    predict_bugs: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                symbol: {
                    type: string;
                    description: string;
                };
                file: {
                    type: string;
                    description: string;
                };
            };
        };
    };
    get_copilot_context: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                file: {
                    type: string;
                    description: string;
                };
                line: {
                    type: string;
                    description: string;
                };
                prefix: {
                    type: string;
                    description: string;
                };
                suffix: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    evaluate_suggestion: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                suggestion: {
                    type: string;
                    description: string;
                };
                file: {
                    type: string;
                    description: string;
                };
                prefix: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    get_patterns: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                category: {
                    type: string;
                    description: string;
                };
                limit: {
                    type: string;
                    description: string;
                };
            };
        };
    };
    get_learning_stats: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {};
        };
    };
    find_hotspots: {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                limit: {
                    type: string;
                    description: string;
                };
            };
        };
    };
};
declare function executeTool(name: string, args: any): Promise<any>;
declare function createMCPServer(port: number): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
export { createMCPServer, TOOLS, executeTool };
