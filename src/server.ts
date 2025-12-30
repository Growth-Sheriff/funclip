/**
 * FuncLib v2 - REST API Server
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import IndexManager from './indexManager';
import { SearchOptions, SymbolKind, Language } from './types';

const app = express();
app.use(cors());
app.use(express.json());

// Project path from env or cwd
const PROJECT_PATH = process.env.FUNCLIB_PROJECT || process.cwd();
const indexManager = new IndexManager(PROJECT_PATH);

// Load existing index
indexManager.load();

// ========================
// Middleware
// ========================

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => 
    Promise.resolve(fn(req, res, next)).catch(next);

const timing = (req: Request, res: Response, next: NextFunction) => {
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
app.get('/health', (req: Request, res: Response) => {
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
app.post('/index', asyncHandler(async (req: Request, res: Response) => {
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
app.post('/index/file', asyncHandler(async (req: Request, res: Response) => {
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
  } else {
    res.status(400).json({ error: 'Failed to index file' });
  }
}));

/**
 * GET /search - Search symbols
 */
app.get('/search', (req: Request, res: Response) => {
  const query = String(req.query.q || '');
  
  if (!query) {
    return res.status(400).json({ error: 'Query required (?q=...)' });
  }

  const options: SearchOptions = {
    query,
    kind: req.query.kind as SymbolKind,
    language: req.query.language as Language,
    file: req.query.file as string,
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
app.get('/symbol/:name', (req: Request, res: Response) => {
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
app.get('/refs/:name', (req: Request, res: Response) => {
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
app.get('/file/*', (req: Request, res: Response) => {
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
app.get('/stats', (req: Request, res: Response) => {
  const stats = indexManager.getStats();
  res.json({
    ...stats,
    project: PROJECT_PATH,
  });
});

/**
 * GET /all - All symbols grouped by file
 */
app.get('/all', (req: Request, res: Response) => {
  const symbols = indexManager.getAllSymbols();
  const grouped: Record<string, any[]> = {};

  for (const s of symbols) {
    if (!grouped[s.file]) grouped[s.file] = [];
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
app.get('/graph', (req: Request, res: Response) => {
  const graph = indexManager.buildCallGraph();
  res.json(graph);
});

/**
 * POST /copilot - Copilot-friendly endpoint
 */
app.post('/copilot', (req: Request, res: Response) => {
  const { action, name, query } = req.body;

  switch (action) {
    case 'search': {
      const results = indexManager.search({ query: query || name, limit: 20 });
      const output = results.map(r => 
        `${r.symbol.file}:${r.symbol.range.start.line} [${r.symbol.kind}] ${r.symbol.signature || r.symbol.name}`
      ).join('\n');
      res.type('text/plain').send(output || 'No results found');
      break;
    }

    case 'refs': {
      const refs = indexManager.findReferences(name);
      let output = '';
      
      if (refs.definitions.length > 0) {
        output += '=== DEFINITIONS ===\n';
        output += refs.definitions.map(d => 
          `${d.file}:${d.range.start.line} - ${d.signature || d.name}`
        ).join('\n');
        output += '\n\n';
      }
      
      if (refs.references.length > 0) {
        output += '=== REFERENCES ===\n';
        output += refs.references.map(r => 
          `${r.file}:${r.range.start.line} - ${r.context}`
        ).join('\n');
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
      
      const output = defs.map(d => 
        `=== ${d.file}:${d.range.start.line} ===\nKind: ${d.kind}\nSignature: ${d.signature}\nExported: ${d.exported ? 'yes' : 'no'}`
      ).join('\n\n');
      
      res.type('text/plain').send(output);
      break;
    }

    default:
      res.status(400).type('text/plain').send(
        'Actions: search, refs, definition\n' +
        'Example: {"action": "refs", "name": "handleSubmit"}'
      );
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3456;

export function startServer() {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              FuncLib v2 - Universal Symbol Index              ║
╠═══════════════════════════════════════════════════════════════╣
║  Port: ${String(PORT).padEnd(53)}║
║  Project: ${PROJECT_PATH.substring(0, 49).padEnd(49)}║
╚═══════════════════════════════════════════════════════════════╝

Endpoints:
  POST /index          - Index project
  GET  /search?q=...   - Search symbols
  GET  /symbol/:name   - Symbol details
  GET  /refs/:name     - Find all references
  POST /copilot        - Copilot endpoint

Supported: JS, TS, Python, Go, Rust, Java, C#, PHP, Ruby, Swift...
`);
  });
}

export default app;
