#!/usr/bin/env node
// src/cli.js - Command line interface

import { Indexer } from './indexer.js';
import { createServer } from './server.js';
import chokidar from 'chokidar';
import path from 'path';

const args = process.argv.slice(2);
const command = args[0];

const HELP = `
╔═══════════════════════════════════════════════════════════════╗
║                    🔍 FuncLib CLI                             ║
║         Function Library & Search for JS/TS Projects          ║
╚═══════════════════════════════════════════════════════════════╝

USAGE:
  funclib <command> [options]

COMMANDS:
  index [--force]      Index all functions in the project
  search <query>       Search for functions by name
  refs <name>          Find all references to a function
  def <name>           Get function definition(s)
  stats                Show index statistics
  files                List all indexed files
  export               Export index as JSON
  serve [--port=3456]  Start API server
  watch                Watch for changes and auto-index

OPTIONS:
  --force              Force reindex all files
  --exact              Exact match only
  --verbose, -v        Verbose output
  --port=<num>         Server port (default: 3456)
  --help, -h           Show this help

EXAMPLES:
  funclib index                    # Index the project
  funclib search fetch             # Search for "fetch"
  funclib refs handleSubmit        # Find all usages of handleSubmit
  funclib def getUserData          # Get function definition
  funclib serve --port=4000        # Start server on port 4000

COPILOT INTEGRATION:
  Start the server with 'funclib serve', then configure Copilot
  to use the API at http://localhost:3456

  Example API calls:
    curl http://localhost:3456/search?q=fetch
    curl http://localhost:3456/refs/handleSubmit
    curl -X POST http://localhost:3456/copilot -H "Content-Type: application/json" \\
         -d '{"query": "fetchData", "action": "refs"}'
`;

// Parse options
const opts = {
  force: args.includes('--force'),
  exact: args.includes('--exact'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  port: parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3456')
};

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  const indexer = new Indexer({ verbose: opts.verbose });

  try {
    switch (command) {
      case 'index': {
        console.log('📚 Indexing project...\n');
        const result = await indexer.indexAll({ force: opts.force });
        console.log('\n✅ Indexing complete!');
        console.log(`   Files scanned: ${result.files}`);
        console.log(`   Files indexed: ${result.indexed}`);
        console.log(`   Files skipped: ${result.skipped}`);
        console.log(`   Functions found: ${result.functions}`);
        console.log(`   References indexed: ${result.references}`);
        console.log(`   Time elapsed: ${result.elapsed}`);
        break;
      }

      case 'search': {
        const query = args[1];
        if (!query) {
          console.error('❌ Missing search query');
          console.log('Usage: funclib search <query>');
          process.exit(1);
        }
        
        const results = indexer.search(query, { exact: opts.exact });
        
        if (results.length === 0) {
          console.log(`No functions found matching "${query}"`);
        } else {
          console.log(`\n🔍 Found ${results.length} function(s) matching "${query}":\n`);
          for (const f of results) {
            console.log(`${f.file_path}:${f.line_start} →`);
            console.log(`   ${f.signature}`);
            console.log('');
          }
        }
        break;
      }

      case 'refs':
      case 'references': {
        const name = args[1];
        if (!name) {
          console.error('❌ Missing function name');
          console.log('Usage: funclib refs <function_name>');
          process.exit(1);
        }
        
        const result = indexer.refs(name);
        
        if (result.totalCount === 0) {
          console.log(`No references found for "${name}"`);
        } else {
          console.log(`\n🔗 References for "${name}" (${result.totalCount} total):\n`);
          
          if (result.definitions.length > 0) {
            console.log('📌 DEFINITIONS:');
            for (const d of result.definitions) {
              console.log(`   ${d.file_path}:${d.line_start}`);
              console.log(`      ${d.signature}`);
            }
            console.log('');
          }
          
          if (result.references.length > 0) {
            console.log('📎 USAGES:');
            for (const r of result.references) {
              console.log(`   ${r.file_path}:${r.line}`);
              console.log(`      ${r.context}`);
            }
          }
        }
        break;
      }

      case 'def':
      case 'definition': {
        const name = args[1];
        if (!name) {
          console.error('❌ Missing function name');
          console.log('Usage: funclib def <function_name>');
          process.exit(1);
        }
        
        const results = indexer.search(name, { exact: true });
        
        if (results.length === 0) {
          console.log(`Function "${name}" not found`);
        } else {
          console.log(`\n📝 Definition(s) for "${name}":\n`);
          for (const f of results) {
            console.log(`${'─'.repeat(60)}`);
            console.log(`📍 ${f.file_path}:${f.line_start}-${f.line_end}`);
            console.log(`${'─'.repeat(60)}`);
            console.log(f.signature + ' ' + f.body);
            console.log('');
          }
        }
        break;
      }

      case 'stats': {
        const stats = indexer.stats();
        console.log('\n📊 Index Statistics:\n');
        console.log(`   Functions: ${stats.functions}`);
        console.log(`   Files: ${stats.files}`);
        console.log(`   References: ${stats.references}`);
        console.log(`   Exported: ${stats.exported}`);
        console.log(`   Async: ${stats.async}`);
        break;
      }

      case 'files': {
        const files = indexer.listFiles();
        console.log(`\n📁 Indexed Files (${files.length}):\n`);
        for (const f of files) {
          console.log(`   ${f.file_path}`);
        }
        break;
      }

      case 'export': {
        const data = indexer.export();
        console.log(JSON.stringify(data, null, 2));
        break;
      }

      case 'serve':
      case 'server': {
        console.log('📚 Initial indexing...');
        await indexer.indexAll();
        
        const server = createServer({ port: opts.port });
        await server.start();
        break;
      }

      case 'watch': {
        console.log('📚 Initial indexing...');
        await indexer.indexAll();
        
        console.log('\n👀 Watching for changes...\n');
        
        const watcher = chokidar.watch([
          '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'
        ], {
          ignored: ['node_modules', 'dist', '.git', '.funclib'],
          persistent: true,
          ignoreInitial: true
        });
        
        watcher.on('change', async (filePath) => {
          console.log(`   📝 Changed: ${filePath}`);
          try {
            const relPath = path.relative(process.cwd(), filePath);
            indexer.indexFile(relPath);
            console.log(`   ✓ Reindexed`);
          } catch (err) {
            console.error(`   ✗ Error: ${err.message}`);
          }
        });
        
        watcher.on('add', async (filePath) => {
          console.log(`   ➕ Added: ${filePath}`);
          try {
            const relPath = path.relative(process.cwd(), filePath);
            indexer.indexFile(relPath);
            console.log(`   ✓ Indexed`);
          } catch (err) {
            console.error(`   ✗ Error: ${err.message}`);
          }
        });
        
        watcher.on('unlink', (filePath) => {
          console.log(`   ➖ Removed: ${filePath}`);
          const relPath = path.relative(process.cwd(), filePath);
          indexer.db.removeFile(relPath);
        });
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "funclib --help" for usage');
        process.exit(1);
    }
  } finally {
    if (!['serve', 'watch'].includes(command)) {
      indexer.close();
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
