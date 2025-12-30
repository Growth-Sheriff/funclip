// src/server.js - Express API server for Copilot integration

import express from 'express';
import Indexer from './indexer.js';

export function createServer(options = {}) {
  const app = express();
  const port = options.port || 3456;
  const indexer = new Indexer(options);

  app.use(express.json());

  // CORS for local development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // ============ ENDPOINTS ============

  /**
   * GET /health - Health check
   */
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * GET /stats - Index statistics
   */
  app.get('/stats', (req, res) => {
    const stats = indexer.stats();
    res.json(stats);
  });

  /**
   * POST /index - Reindex all files
   */
  app.post('/index', async (req, res) => {
    try {
      const force = req.body.force || false;
      const result = await indexer.indexAll({ force });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /search?q=name - Search functions by name
   * Query params:
   *   - q: search query (required)
   *   - exact: exact match (optional)
   *   - fts: full-text search (optional)
   */
  app.get('/search', (req, res) => {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter "q"' });
    }

    const exact = req.query.exact === 'true';
    const fts = req.query.fts === 'true';
    
    const results = indexer.search(query, { exact, fts });
    
    res.json({
      query,
      count: results.length,
      results: results.map(formatFunction)
    });
  });

  /**
   * GET /refs/:name - Get all references to a function
   */
  app.get('/refs/:name', (req, res) => {
    const name = req.params.name;
    const result = indexer.refs(name);
    
    res.json({
      function: name,
      definitionCount: result.definitions.length,
      referenceCount: result.references.length,
      totalCount: result.totalCount,
      definitions: result.definitions.map(formatFunction),
      references: result.references.map(formatRef)
    });
  });

  /**
   * GET /function/:name - Get function definition(s)
   */
  app.get('/function/:name', (req, res) => {
    const name = req.params.name;
    const results = indexer.search(name, { exact: true });
    
    if (results.length === 0) {
      return res.status(404).json({ error: `Function "${name}" not found` });
    }

    res.json({
      function: name,
      count: results.length,
      definitions: results.map(formatFunctionFull)
    });
  });

  /**
   * GET /file/:path - Get functions in a file
   */
  app.get('/file/*', (req, res) => {
    const filePath = req.params[0];
    const functions = indexer.getFunctionsInFile(filePath);
    
    res.json({
      file: filePath,
      count: functions.length,
      functions: functions.map(formatFunction)
    });
  });

  /**
   * GET /files - List all indexed files
   */
  app.get('/files', (req, res) => {
    const files = indexer.listFiles();
    res.json({
      count: files.length,
      files: files.map(f => f.file_path)
    });
  });

  /**
   * GET /export - Export full index as JSON
   */
  app.get('/export', (req, res) => {
    const data = indexer.export();
    res.json(data);
  });

  /**
   * POST /copilot - Copilot-friendly endpoint
   * Accepts natural language queries and returns formatted results
   */
  app.post('/copilot', (req, res) => {
    const { query, action } = req.body;
    
    if (!query && !action) {
      return res.status(400).json({ 
        error: 'Missing query or action',
        usage: {
          search: { query: 'function name', action: 'search' },
          refs: { query: 'function name', action: 'refs' },
          definition: { query: 'function name', action: 'definition' }
        }
      });
    }

    try {
      let result;
      const searchAction = action || 'search';
      
      switch (searchAction) {
        case 'refs':
        case 'references':
          result = indexer.refs(query);
          return res.json(formatCopilotRefs(query, result));
          
        case 'definition':
        case 'def':
          result = indexer.search(query, { exact: true });
          return res.json(formatCopilotDefinition(query, result));
          
        case 'search':
        default:
          result = indexer.search(query);
          return res.json(formatCopilotSearch(query, result));
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============ FORMATTERS ============

  function formatFunction(f) {
    return {
      name: f.name,
      type: f.type,
      params: f.params,
      signature: f.signature,
      file: f.file_path,
      line: f.line_start,
      lineEnd: f.line_end,
      exported: !!f.is_exported,
      async: !!f.is_async
    };
  }

  function formatFunctionFull(f) {
    return {
      ...formatFunction(f),
      body: f.body
    };
  }

  function formatRef(r) {
    return {
      file: r.file_path,
      line: r.line,
      column: r.column_num,
      context: r.context
    };
  }

  // Copilot-friendly formatters
  function formatCopilotSearch(query, results) {
    if (results.length === 0) {
      return {
        message: `No functions found matching "${query}"`,
        count: 0,
        results: []
      };
    }

    return {
      message: `Found ${results.length} function(s) matching "${query}"`,
      count: results.length,
      results: results.map(f => ({
        location: `${f.file_path}:${f.line_start}`,
        signature: f.signature,
        type: f.type,
        exported: !!f.is_exported
      }))
    };
  }

  function formatCopilotRefs(name, result) {
    const total = result.totalCount;
    
    if (total === 0) {
      return {
        message: `No references found for "${name}"`,
        count: 0
      };
    }

    const lines = [];
    
    if (result.definitions.length > 0) {
      lines.push(`📌 DEFINITIONS (${result.definitions.length}):`);
      for (const d of result.definitions) {
        lines.push(`   ${d.file_path}:${d.line_start} - ${d.signature}`);
      }
    }
    
    if (result.references.length > 0) {
      lines.push(`\n🔗 REFERENCES (${result.references.length}):`);
      for (const r of result.references) {
        lines.push(`   ${r.file_path}:${r.line} - ${r.context}`);
      }
    }

    return {
      message: `Found ${total} reference(s) for "${name}"`,
      count: total,
      definitionCount: result.definitions.length,
      referenceCount: result.references.length,
      formatted: lines.join('\n'),
      definitions: result.definitions.map(formatFunction),
      references: result.references.map(formatRef)
    };
  }

  function formatCopilotDefinition(name, results) {
    if (results.length === 0) {
      return {
        message: `Function "${name}" not found`,
        count: 0
      };
    }

    return {
      message: `Found ${results.length} definition(s) for "${name}"`,
      count: results.length,
      definitions: results.map(f => ({
        location: `${f.file_path}:${f.line_start}-${f.line_end}`,
        signature: f.signature,
        body: f.body,
        exported: !!f.is_exported,
        async: !!f.is_async
      }))
    };
  }

  // ============ START ============

  function start() {
    return new Promise((resolve) => {
      const server = app.listen(port, () => {
        console.log(`\n🚀 FuncLib Server running at http://localhost:${port}`);
        console.log(`\nEndpoints:`);
        console.log(`   GET  /health        - Health check`);
        console.log(`   GET  /stats         - Index statistics`);
        console.log(`   POST /index         - Reindex all files`);
        console.log(`   GET  /search?q=name - Search functions`);
        console.log(`   GET  /refs/:name    - Get all references`);
        console.log(`   GET  /function/:name- Get function definition`);
        console.log(`   POST /copilot       - Copilot-friendly queries`);
        console.log(`   GET  /export        - Export full index`);
        console.log('');
        resolve(server);
      });
    });
  }

  return { app, start, indexer };
}

export default createServer;
