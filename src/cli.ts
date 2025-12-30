#!/usr/bin/env node
/**
 * FuncLib v4 - CLI Tool
 * AI-powered code intelligence
 */

import * as path from 'path';
import IndexManager from './indexManager';
import { startServer } from './server';
import { createMCPServer } from './mcp';
import { QueryEngine } from './output/queryEngine';
import { getReasoningEngine } from './reasoning/llmClient';

const args = process.argv.slice(2);
const command = args[0];
const PROJECT_PATH = process.env.FUNCLIB_PROJECT || process.cwd();

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(msg: string, color: keyof typeof c = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`);
}

function printHelp() {
  console.log(`
${c.bold}FuncLib v4 - AI-Powered Code Intelligence${c.reset}

${c.cyan}Usage:${c.reset}
  funclib <command> [options]

${c.cyan}Core Commands:${c.reset}
  ${c.green}index${c.reset}              Index the project (Tree-sitter AST)
  ${c.green}search${c.reset} <query>     Search for symbols
  ${c.green}refs${c.reset} <name>        Find all references
  ${c.green}symbol${c.reset} <name>      Get symbol details
  ${c.green}list${c.reset} [kind]        List all symbols
  ${c.green}file${c.reset} <path>        Show symbols in file
  ${c.green}stats${c.reset}              Show index statistics
  ${c.green}graph${c.reset}              Show call graph
  ${c.green}watch${c.reset}              Watch for changes and auto-reindex

${c.cyan}AI Commands (v4):${c.reset}
  ${c.magenta}ask${c.reset} <question>    Ask anything about the code (semantic + LLM)
  ${c.magenta}impact${c.reset} <symbol>   Analyze change impact
  ${c.magenta}bugs${c.reset} [file]       Predict potential bugs
  ${c.magenta}build-ai${c.reset}          Build vector index & knowledge graph
  ${c.magenta}status${c.reset}            Check AI system status
  ${c.magenta}hotspots${c.reset}          Find frequently changed files (Git)
  ${c.magenta}complexity${c.reset} <file> Calculate code complexity metrics
  ${c.magenta}markers${c.reset}           Find TODO/FIXME/HACK in code
  ${c.magenta}trends${c.reset}            Show project change trends
  ${c.magenta}guide${c.reset} <file>      Get Copilot guidance for file
  ${c.magenta}learn${c.reset}             Show learned preferences & stats
  ${c.magenta}patterns${c.reset}          Show cross-project patterns

${c.cyan}Server Commands:${c.reset}
  ${c.green}serve${c.reset}              Start REST API server (port 3456)
  ${c.green}mcp${c.reset}                Start MCP server for Copilot (port 3457)

${c.cyan}Examples:${c.reset}
  funclib index
  funclib search handleSubmit
  funclib refs fetchData
  funclib symbol UserService
  funclib list function
  funclib watch
  funclib hotspots
  funclib ask "sepete ürün ekleme nerede?"
  funclib impact useEditorStore
  funclib bugs src/services/
  funclib guide src/utils.ts
  funclib learn
  funclib patterns
  funclib serve
  funclib mcp

${c.cyan}Environment:${c.reset}
  FUNCLIB_PROJECT    Project directory (default: cwd)
  PORT               REST API server port (default: 3456)
  MCP_PORT           MCP server port (default: 3457)
  GROQ_API_KEY       Groq API key (optional, for cloud LLM)

${c.cyan}AI Features:${c.reset}
  • Semantic code search (Transformers.js)
  • Natural language queries
  • Bug prediction
  • Change impact analysis
  • LLM reasoning (Ollama/Groq)

${c.cyan}Supported Languages:${c.reset}
  JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin,
  C#, C/C++, PHP, Ruby, Swift, Dart, Vue, and more!
`);
}

async function main() {
  const indexManager = new IndexManager(PROJECT_PATH);
  indexManager.load();

  switch (command) {
    case 'index': {
      log('\n🔍 Indexing project with Tree-sitter...', 'cyan');
      const start = Date.now();
      
      const result = await indexManager.indexProject({
        incremental: !args.includes('--full'),
        onProgress: (current, total, file) => {
          process.stdout.write(`\r   Processing: ${current}/${total} - ${file.substring(0, 50).padEnd(50)}`);
        },
      });
      
      const elapsed = Date.now() - start;
      console.log('\r' + ' '.repeat(80) + '\r'); // Clear line
      
      log(`✅ Indexing complete (${elapsed}ms)`, 'green');
      log(`   📁 ${result.indexed} files indexed`, 'dim');
      log(`   ⏭️  ${result.skipped} files skipped (unchanged)`, 'dim');
      
      if (result.errors.length > 0) {
        log(`   ⚠️  ${result.errors.length} errors`, 'yellow');
      }
      
      const stats = indexManager.getStats();
      log(`   📊 Total: ${stats.totalSymbols} symbols, ${stats.totalReferences} references`, 'dim');
      
      // Show language breakdown
      const langs = Object.entries(stats.byLanguage)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      if (langs.length > 0) {
        log(`   🌐 Languages: ${langs.map(([l, c]) => `${l}(${c})`).join(', ')}`, 'dim');
      }
      console.log();
      break;
    }

    case 'search': {
      const query = args[1];
      if (!query) {
        log('❌ Search query required: funclib search <query>', 'red');
        process.exit(1);
      }

      const results = indexManager.search({ query, limit: 30 });
      
      if (results.length === 0) {
        log(`\n❌ No results for "${query}"\n`, 'yellow');
        break;
      }

      log(`\n🔎 Found ${results.length} results for "${query}":\n`, 'cyan');
      
      for (const r of results) {
        const s = r.symbol;
        const kindIcon = getKindIcon(s.kind);
        const exported = s.exported ? '📤' : '';
        const async = s.async ? '⚡' : '';
        
        log(`${kindIcon} ${c.bold}${s.name}${c.reset} ${async}${exported}`, 'reset');
        log(`   ${c.dim}${s.file}:${s.range.start.line}${c.reset}`, 'reset');
        if (s.signature) {
          log(`   ${c.blue}${truncate(s.signature, 70)}${c.reset}`, 'reset');
        }
        console.log();
      }
      break;
    }

    case 'refs': {
      const name = args[1];
      if (!name) {
        log('❌ Symbol name required: funclib refs <name>', 'red');
        process.exit(1);
      }

      const refs = indexManager.findReferences(name);
      
      log(`\n📍 References for "${name}":`, 'cyan');
      log(`   ${refs.definitions.length} definition(s), ${refs.references.length} reference(s)\n`, 'dim');
      
      if (refs.definitions.length > 0) {
        log('=== DEFINITIONS ===', 'green');
        for (const d of refs.definitions) {
          log(`${d.file}:${d.range.start.line}`, 'bold');
          log(`   ${c.blue}${d.signature || d.name}${c.reset}`, 'reset');
        }
        console.log();
      }
      
      if (refs.references.length > 0) {
        log('=== REFERENCES ===', 'yellow');
        for (const r of refs.references) {
          log(`${r.file}:${r.range.start.line}`, 'bold');
          log(`   ${c.dim}${truncate(r.context, 60)}${c.reset}`, 'reset');
        }
      }
      
      if (refs.total === 0) {
        log(`No references found for "${name}"`, 'yellow');
      }
      console.log();
      break;
    }

    case 'symbol': {
      const name = args[1];
      if (!name) {
        log('❌ Symbol name required: funclib symbol <name>', 'red');
        process.exit(1);
      }

      const defs = indexManager.getAllDefinitions(name);
      
      if (defs.length === 0) {
        log(`\n❌ Symbol not found: ${name}\n`, 'yellow');
        break;
      }

      log(`\n📦 Symbol: ${name} (${defs.length} definition${defs.length > 1 ? 's' : ''})\n`, 'cyan');
      
      for (const d of defs) {
        log(`${'═'.repeat(60)}`, 'dim');
        log(`📄 ${d.file}:${d.range.start.line}`, 'bold');
        log(`${'─'.repeat(60)}`, 'dim');
        log(`Kind:       ${d.kind}`, 'reset');
        log(`Language:   ${d.language}`, 'reset');
        log(`Exported:   ${d.exported ? 'yes' : 'no'}`, 'reset');
        if (d.async) log(`Async:      yes`, 'reset');
        if (d.static) log(`Static:     yes`, 'reset');
        if (d.visibility) log(`Visibility: ${d.visibility}`, 'reset');
        if (d.parent) log(`Parent:     ${d.parent}`, 'reset');
        if (d.parameters && d.parameters.length > 0) {
          log(`Parameters: ${d.parameters.map(p => p.name).join(', ')}`, 'reset');
        }
        if (d.signature) {
          log(`\nSignature:`, 'cyan');
          log(`  ${d.signature}`, 'blue');
        }
        console.log();
      }
      break;
    }

    case 'list': {
      const kindFilter = args[1];
      const symbols = indexManager.getAllSymbols();
      
      const filtered = kindFilter 
        ? symbols.filter(s => s.kind === kindFilter)
        : symbols;
      
      const byKind: Record<string, typeof symbols> = {};
      for (const s of filtered) {
        if (!byKind[s.kind]) byKind[s.kind] = [];
        byKind[s.kind].push(s);
      }

      log(`\n📚 All Symbols (${filtered.length} total)\n`, 'cyan');
      
      for (const [kind, items] of Object.entries(byKind)) {
        log(`\n${getKindIcon(kind)} ${kind.toUpperCase()} (${items.length})`, 'bold');
        log('─'.repeat(40), 'dim');
        
        for (const s of items.slice(0, 50)) {
          const exp = s.exported ? ' 📤' : '';
          log(`  ${s.name}${exp}  ${c.dim}${s.file}:${s.range.start.line}${c.reset}`, 'reset');
        }
        
        if (items.length > 50) {
          log(`  ${c.dim}... and ${items.length - 50} more${c.reset}`, 'reset');
        }
      }
      console.log();
      break;
    }

    case 'file': {
      const filePath = args[1];
      if (!filePath) {
        log('❌ File path required: funclib file <path>', 'red');
        process.exit(1);
      }

      const symbols = indexManager.getSymbolsInFile(filePath);
      
      if (symbols.length === 0) {
        log(`\n❌ No symbols found in: ${filePath}\n`, 'yellow');
        break;
      }

      log(`\n📄 ${filePath} (${symbols.length} symbols)\n`, 'cyan');
      
      for (const s of symbols) {
        const icon = getKindIcon(s.kind);
        log(`  ${s.range.start.line.toString().padStart(4)} │ ${icon} ${s.name}`, 'reset');
      }
      console.log();
      break;
    }

    case 'stats': {
      const stats = indexManager.getStats();
      
      log('\n📊 Index Statistics\n', 'cyan');
      log(`   Project:     ${PROJECT_PATH}`, 'reset');
      log(`   Files:       ${stats.totalFiles}`, 'reset');
      log(`   Symbols:     ${stats.totalSymbols}`, 'reset');
      log(`   References:  ${stats.totalReferences}`, 'reset');
      
      if (Object.keys(stats.byLanguage).length > 0) {
        log('\n   By Language:', 'bold');
        for (const [lang, count] of Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1])) {
          if (count > 0) log(`     ${lang.padEnd(12)} ${count}`, 'dim');
        }
      }
      
      if (Object.keys(stats.byKind).length > 0) {
        log('\n   By Kind:', 'bold');
        for (const [kind, count] of Object.entries(stats.byKind).sort((a, b) => b[1] - a[1])) {
          log(`     ${kind.padEnd(12)} ${count}`, 'dim');
        }
      }
      console.log();
      break;
    }

    case 'graph': {
      const graph = indexManager.buildCallGraph();
      
      log('\n🔗 Call Graph\n', 'cyan');
      log(`   Nodes: ${graph.nodes.length}`, 'dim');
      log(`   Edges: ${graph.edges.length}`, 'dim');
      
      if (graph.edges.length > 0) {
        log('\n   Calls:', 'bold');
        for (const edge of graph.edges.slice(0, 30)) {
          log(`     ${edge.from.split(':')[1]} → ${edge.to} (${edge.count}x)`, 'reset');
        }
        if (graph.edges.length > 30) {
          log(`     ... and ${graph.edges.length - 30} more`, 'dim');
        }
      }
      console.log();
      break;
    }

    case 'serve': {
      log('\n🚀 Starting REST API server...', 'cyan');
      startServer();
      break;
    }

    case 'mcp': {
      log('\n🤖 Starting MCP server...', 'cyan');
      const mcpPort = parseInt(process.env.MCP_PORT || '3457');
      createMCPServer(mcpPort);
      break;
    }

    case 'watch': {
      log('\n👁️ Watch mode başlatılıyor...\n', 'cyan');
      
      const chokidar = await import('chokidar').catch(() => null);
      if (!chokidar) {
        log('❌ chokidar paketi gerekli: npm install chokidar', 'red');
        break;
      }

      const DEBOUNCE_MS = 500;
      let timeout: NodeJS.Timeout | null = null;
      const pendingFiles = new Set<string>();

      const watcher = chokidar.default.watch([
        '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
        '**/*.vue', '**/*.py', '**/*.go', '**/*.rs',
      ], {
        cwd: PROJECT_PATH,
        ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.funclib/**'],
        persistent: true,
        ignoreInitial: true,
      });

      log(`📂 Proje: ${PROJECT_PATH}`, 'dim');
      log('📡 Değişiklikler izleniyor... (Ctrl+C ile çık)\n', 'green');

      const processChanges = async () => {
        if (pendingFiles.size === 0) return;
        
        const files = Array.from(pendingFiles);
        pendingFiles.clear();
        
        log(`\n🔄 ${files.length} dosya değişti, yeniden indeksleniyor...`, 'yellow');
        
        for (const file of files) {
          try {
            await indexManager.indexFile(file);
            log(`   ✅ ${file}`, 'green');
          } catch (e) {
            log(`   ❌ ${file}`, 'red');
          }
        }
        
        log(`✅ Incremental index tamamlandı (${files.length} dosya)\n`, 'green');
      };

      watcher.on('change', (filePath: string) => {
        pendingFiles.add(filePath);
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(processChanges, DEBOUNCE_MS);
      });

      watcher.on('add', (filePath: string) => {
        pendingFiles.add(filePath);
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(processChanges, DEBOUNCE_MS);
      });

      watcher.on('unlink', (filePath: string) => {
        log(`🗑️ Dosya silindi: ${filePath}`, 'dim');
      });

      // Keep running
      await new Promise(() => {});
      break;
    }

    // ============ AI COMMANDS (v4) ============

    case 'ask': {
      const question = args.slice(1).join(' ');
      if (!question) {
        log('❌ Question required: funclib ask "your question"', 'red');
        process.exit(1);
      }

      const queryEngine = new QueryEngine(PROJECT_PATH);
      const ready = await queryEngine.checkReady();

      if (!ready.indexReady) {
        log('⚠️ Index bulunamadı. Önce `funclib index` çalıştırın.', 'yellow');
        break;
      }

      if (!ready.vectorReady) {
        log('💡 Vector index yok. `funclib build-ai` ile AI özelliklerini aktif edin.', 'dim');
      }

      log(`\n🧠 Sorgunuz: "${question}"\n`, 'cyan');
      
      const result = await queryEngine.ask(question, {
        useLLM: ready.llmReady,
        maxResults: 10,
        includeCode: true,
      });

      log(result.answer, 'reset');
      
      if (result.relevantCode.length > 0) {
        log('\n📍 İlgili Kodlar:', 'cyan');
        for (const code of result.relevantCode.slice(0, 5)) {
          log(`   ${code.name} (${code.kind}) @ ${code.file}:${code.line}`, 'dim');
        }
      }

      if (result.suggestions.length > 0) {
        log('\n💡 Öneriler:', 'yellow');
        result.suggestions.forEach((s, i) => log(`   ${i + 1}. ${s}`, 'reset'));
      }

      log(`\n📊 Güven: ${(result.confidence * 100).toFixed(0)}%`, 'dim');
      console.log();
      break;
    }

    case 'impact': {
      const symbolName = args[1];
      if (!symbolName) {
        log('❌ Symbol name required: funclib impact <symbol>', 'red');
        process.exit(1);
      }

      log(`\n🔍 Etki analizi: "${symbolName}"\n`, 'cyan');

      const queryEngine = new QueryEngine(PROJECT_PATH);
      const result = await queryEngine.analyzeChange(symbolName);

      log(result.answer, 'reset');

      if (result.suggestions.length > 0) {
        log('\n💡 Öneriler:', 'yellow');
        result.suggestions.forEach((s, i) => log(`   ${i + 1}. ${s}`, 'reset'));
      }
      console.log();
      break;
    }

    case 'bugs': {
      const filePath = args[1];
      
      log(`\n🐛 Bug tahmini${filePath ? `: ${filePath}` : ' (proje geneli)'}...\n`, 'cyan');

      const queryEngine = new QueryEngine(PROJECT_PATH);
      const ready = await queryEngine.checkReady();

      if (!ready.llmReady) {
        log('⚠️ LLM bağlantısı yok.', 'yellow');
        log('   Ollama kurun: winget install Ollama.Ollama', 'dim');
        log('   Başlatın: ollama serve', 'dim');
        log('   Model: ollama pull codellama:7b\n', 'dim');
        break;
      }

      const result = await queryEngine.predictBugs(filePath);

      log(result.answer, 'reset');

      if (result.suggestions.length > 0) {
        log('\n💡 Öneriler:', 'yellow');
        result.suggestions.forEach((s, i) => log(`   ${i + 1}. ${s}`, 'reset'));
      }
      console.log();
      break;
    }

    case 'build-ai': {
      log('\n🧠 AI Index oluşturuluyor...\n', 'cyan');

      const queryEngine = new QueryEngine(PROJECT_PATH);
      const ready = await queryEngine.checkReady();

      if (!ready.indexReady) {
        log('⚠️ Önce `funclib index` çalıştırın.\n', 'yellow');
        break;
      }

      // 1. Knowledge Graph
      log('📊 Knowledge Graph...', 'reset');
      queryEngine.buildKnowledgeGraph();

      // 2. Vector Index
      log('\n🔢 Vector Embeddings...', 'reset');
      await queryEngine.buildVectorIndex();

      // 3. LLM durumu
      const health = await getReasoningEngine().checkHealth();
      if (health.available) {
        log(`\n✅ LLM: ${health.model} (${health.provider})`, 'green');
      } else {
        log('\n⚠️ LLM bağlantısı yok. AI sorguları sınırlı çalışacak.', 'yellow');
        log('   Ollama kurun: winget install Ollama.Ollama', 'dim');
      }

      log('\n🎉 AI index hazır! `funclib ask` kullanabilirsiniz.\n', 'green');
      break;
    }

    // ============ ANALYSIS COMMANDS ============

    case 'hotspots': {
      log('\n🔥 Hotspot Analizi (Sık Değişen Dosyalar)\n', 'cyan');

      const { getGitCollector } = await import('./collectors/gitCollector');
      const gitCollector = getGitCollector(PROJECT_PATH);
      
      const limit = parseInt(args[1]) || 20;
      const hotspots = gitCollector.getHotspots(limit);

      if (hotspots.length === 0) {
        log('⚠️ Git geçmişi bulunamadı veya henüz commit yok.', 'yellow');
        break;
      }

      log(`📊 En sık değişen ${hotspots.length} dosya:\n`, 'reset');
      
      hotspots.forEach((h, i) => {
        const bar = '█'.repeat(Math.ceil(h.changeCount / hotspots[0].changeCount * 20));
        log(`   ${String(i + 1).padStart(2)}. ${h.file}`, 'reset');
        log(`       ${bar} ${h.changeCount} değişiklik, ${h.authors.length} yazar`, 'dim');
      });

      log('\n💡 Hotspot\'lar refactoring adaylarıdır - sık değişen kod genellikle karmaşıktır.\n', 'dim');
      break;
    }

    case 'complexity': {
      const targetFile = args[1];
      
      if (!targetFile) {
        log('❌ Dosya yolu gerekli: funclib complexity <file>', 'red');
        process.exit(1);
      }

      const filePath = path.resolve(PROJECT_PATH, targetFile);
      
      log(`\n📐 Complexity Analizi: ${targetFile}\n`, 'cyan');

      const { ComplexityCalculator } = await import('./parsers/complexityCalculator');
      const calculator = new ComplexityCalculator();
      
      const fs = await import('fs');
      if (!fs.existsSync(filePath)) {
        log(`❌ Dosya bulunamadı: ${filePath}`, 'red');
        break;
      }

      const code = fs.readFileSync(filePath, 'utf-8');
      
      // Dosya için genel complexity hesapla
      const overallMetrics = calculator.calculate(code);

      log(`📊 Dosya Metrikleri:`, 'reset');
      log(`   Kod Satırı:          ${overallMetrics.linesOfCode}`, 'reset');
      log(`   Yorum Satırı:        ${overallMetrics.linesOfComments}`, 'reset');
      log(`   Boş Satır:           ${overallMetrics.blankLines}`, 'reset');
      log(`   Cyclomatic:          ${overallMetrics.cyclomatic}`, overallMetrics.cyclomatic > 15 ? 'red' : 'green');
      log(`   Cognitive:           ${overallMetrics.cognitive}`, overallMetrics.cognitive > 20 ? 'red' : 'green');
      log(`   Maintainability:     ${overallMetrics.maintainability.toFixed(1)}`, overallMetrics.maintainability < 20 ? 'red' : 'green');

      if (overallMetrics.halstead) {
        log(`\n📈 Halstead Metrikleri:`, 'cyan');
        log(`   Vocabulary:  ${overallMetrics.halstead.vocabulary}`, 'dim');
        log(`   Length:      ${overallMetrics.halstead.length}`, 'dim');
        log(`   Volume:      ${overallMetrics.halstead.volume.toFixed(1)}`, 'dim');
        log(`   Difficulty:  ${overallMetrics.halstead.difficulty.toFixed(1)}`, 'dim');
        log(`   Effort:      ${overallMetrics.halstead.effort.toFixed(0)}`, 'dim');
        log(`   Est. Bugs:   ${overallMetrics.halstead.bugs.toFixed(2)}`, 'dim');
      }

      // Risk seviyesi
      const riskScore = (overallMetrics.cyclomatic / 10) + (overallMetrics.cognitive / 15) + ((100 - overallMetrics.maintainability) / 50);
      const riskLevel = riskScore > 3 ? '🔴 Yüksek' : riskScore > 1.5 ? '🟡 Orta' : '🟢 Düşük';
      
      log(`\n📊 Risk Seviyesi: ${riskLevel}`, 'reset');
      console.log();
      break;
    }

    case 'markers': {
      log('\n🏷️ Kod Marker\'ları (TODO/FIXME/HACK)\n', 'cyan');

      const { JSDocParser } = await import('./parsers/jsdocParser');
      const parser = new JSDocParser();
      
      const fs = await import('fs');
      const glob = await import('glob').catch(() => null);
      
      if (!glob) {
        log('❌ glob paketi gerekli: npm install glob', 'red');
        break;
      }

      const files = glob.sync('**/*.{ts,tsx,js,jsx,vue,py}', {
        cwd: PROJECT_PATH,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.funclib/**'],
      });

      const allMarkers: Array<{ file: string; type: string; text: string; line: number }> = [];

      for (const file of files) {
        const filePath = path.join(PROJECT_PATH, file);
        const code = fs.readFileSync(filePath, 'utf-8');
        const markers = parser.extractMarkers(code);
        
        for (const marker of markers) {
          allMarkers.push({ file, type: marker.type, text: marker.text, line: marker.line });
        }
      }

      if (allMarkers.length === 0) {
        log('✅ Hiç marker bulunamadı! Temiz kod.', 'green');
        break;
      }

      // Group by type
      const byType: Record<string, typeof allMarkers> = {};
      for (const m of allMarkers) {
        if (!byType[m.type]) byType[m.type] = [];
        byType[m.type].push(m);
      }

      // Sort by priority
      const typeOrder = ['FIXME', 'BUG', 'HACK', 'XXX', 'TODO', 'OPTIMIZE', 'NOTE'];
      const sortedTypes = Object.keys(byType).sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));

      for (const type of sortedTypes) {
        const markers = byType[type];
        const icon = type === 'FIXME' || type === 'BUG' ? '🔴' :
                     type === 'HACK' || type === 'XXX' ? '🟠' :
                     type === 'TODO' ? '🟡' : '🔵';
        
        log(`${icon} ${type} (${markers.length}):\n`, 'reset');
        
        for (const m of markers.slice(0, 10)) {
          log(`   ${m.file}:${m.line}`, 'dim');
          log(`   └─ ${truncate(m.text, 60)}`, 'reset');
        }
        
        if (markers.length > 10) {
          log(`   ... ve ${markers.length - 10} tane daha\n`, 'dim');
        }
        console.log();
      }

      log(`📊 Toplam: ${allMarkers.length} marker bulundu\n`, 'cyan');
      break;
    }

    case 'trends': {
      log('\n📈 Proje Trend Analizi\n', 'cyan');

      const { getTemporalMemory } = await import('./memory/temporalMemory');
      const memory = getTemporalMemory(PROJECT_PATH);
      
      const trends = memory.analyzeTrends();
      const anomalies = memory.detectAnomalies();

      if (!trends.mostChanged.length) {
        log('⚠️ Henüz temporal data yok. Projeyi kullandıkça veriler birikecek.', 'yellow');
        log('   `funclib watch` ile dosya değişikliklerini izleyebilirsiniz.', 'dim');
        break;
      }

      log('🔥 En Çok Değişen Dosyalar:', 'reset');
      for (const f of trends.mostChanged.slice(0, 10)) {
        log(`   ${f.file} - ${f.changes} değişiklik`, 'dim');
      }

      log('\n👥 En Aktif Yazarlar:', 'reset');
      for (const a of trends.mostActive.slice(0, 5)) {
        log(`   ${a.author} - ${a.commits} commit`, 'dim');
      }

      if (trends.bugFixTrend.length > 0) {
        log('\n🐛 Bug Fix Trendi:', 'reset');
        for (const b of trends.bugFixTrend.slice(-4)) {
          const bar = '█'.repeat(Math.min(b.count, 30));
          log(`   ${b.week}: ${bar} (${b.count})`, 'dim');
        }
      }

      if (anomalies.length > 0) {
        log('\n⚠️ Anomaliler:', 'red');
        for (const a of anomalies.slice(0, 5)) {
          log(`   ${a.type}: ${a.file || a.commit}`, 'reset');
          log(`   └─ ${a.description}`, 'dim');
        }
      }

      console.log();
      break;
    }

    // ============ NEW AI COMMANDS (v4.1) ============

    case 'guide': {
      const targetFile = args[1];
      if (!targetFile) {
        log('❌ Dosya yolu gerekli: funclib guide <file>', 'red');
        process.exit(1);
      }

      log(`\n🎯 Copilot Kılavuzu: ${targetFile}\n`, 'cyan');

      const { getCopilotGuide } = await import('./output/copilotGuide');
      const guide = getCopilotGuide();
      
      const fs = await import('fs');
      const fullPath = path.resolve(PROJECT_PATH, targetFile);
      
      if (!fs.existsSync(fullPath)) {
        log(`❌ Dosya bulunamadı: ${fullPath}`, 'red');
        break;
      }

      const code = fs.readFileSync(fullPath, 'utf-8');
      const lines = code.split('\n');
      const prefix = lines.slice(0, 20).join('\n');
      const suffix = lines.slice(-20).join('\n');

      const context = guide.prepareContext(targetFile);

      if (context.relatedSymbols.length > 0) {
        log('📦 İlgili Semboller:', 'reset');
        for (const sym of context.relatedSymbols.slice(0, 10)) {
          log(`   ${sym.name} (${sym.kind})`, 'dim');
        }
        console.log();
      }

      if (context.recentChanges.length > 0) {
        log('📝 Son Değişiklikler:', 'reset');
        for (const change of context.recentChanges.slice(0, 5)) {
          const date = change.date.toISOString().split('T')[0];
          log(`   ${date}: ${change.type} ${change.symbol}`, 'dim');
        }
        console.log();
      }

      if (context.patterns.length > 0) {
        log('🔄 Önerilen Pattern\'lar:', 'reset');
        for (const pattern of context.patterns.slice(0, 5)) {
          log(`   ${pattern.name} (${pattern.frequency} kullanım)`, 'dim');
          if (pattern.description) log(`   └─ ${pattern.description}`, 'dim');
        }
        console.log();
      }

      if (context.warnings.length > 0) {
        log('⚠️ Uyarılar:', 'yellow');
        for (const warn of context.warnings) {
          const icon = warn.severity === 'error' ? '🔴' : warn.severity === 'warning' ? '🟡' : '🔵';
          log(`   ${icon} ${warn.message}`, 'reset');
        }
        console.log();
      }

      console.log();
      break;
    }

    case 'learn': {
      log('\n🧠 Öğrenme İstatistikleri\n', 'cyan');

      const { getSelfLearning } = await import('./reasoning/selfLearning');
      const learning = getSelfLearning();
      
      const stats = learning.getStats();
      const copilotStats = learning.getCopilotAcceptanceRate();
      const stabilityScore = learning.getCommitStabilityScore();

      log(`📊 Genel İstatistikler:`, 'reset');
      log(`   Toplam Feedback:    ${stats.totalFeedbacks}`, 'dim');
      log(`   Kabul Oranı:        ${(stats.acceptanceRate * 100).toFixed(1)}%`, 'dim');
      log(`   Ortalama Reward:    ${stats.avgReward.toFixed(2)}`, 'dim');
      log(`   Öğrenme Hızı:       ${stats.learningVelocity > 0 ? '↑' : '↓'} ${Math.abs(stats.learningVelocity * 100).toFixed(1)}%`, 'dim');

      log(`\n🤖 Copilot İstatistikleri:`, 'reset');
      log(`   Genel Kabul Oranı:  ${(copilotStats.overall * 100).toFixed(1)}%`, 'dim');
      
      if (copilotStats.byContext.size > 0) {
        log(`   Dosya Tipine Göre:`, 'dim');
        for (const [ext, rate] of copilotStats.byContext) {
          log(`     .${ext}: ${(rate * 100).toFixed(1)}%`, 'dim');
        }
      }

      log(`\n📦 Commit Stabilitesi: ${(stabilityScore * 100).toFixed(0)}%`, 'reset');

      if (stats.topPatterns.length > 0) {
        log(`\n🔝 En Önemli Pattern'lar:`, 'reset');
        for (const pattern of stats.topPatterns.slice(0, 10)) {
          const direction = pattern.weight > 0 ? '✅' : '❌';
          log(`   ${direction} ${pattern.pattern} (${pattern.weight.toFixed(2)})`, 'dim');
        }
      }

      console.log();
      break;
    }

    case 'patterns': {
      log('\n🔄 Cross-Project Pattern\'lar\n', 'cyan');

      const { getCrossProjectKB } = await import('./memory/crossProjectKB');
      const kb = getCrossProjectKB();

      const mostUsed = kb.getMostUsedPatterns(undefined, 15);
      
      if (mostUsed.length === 0) {
        log('⚠️ Henüz pattern kaydedilmemiş.', 'yellow');
        log('   Kod yazıldıkça pattern\'lar otomatik öğrenilecek.', 'dim');
        break;
      }

      log('📚 En Çok Kullanılan Pattern\'lar:', 'reset');
      for (const pattern of mostUsed) {
        const bar = '█'.repeat(Math.ceil(pattern.frequency / (mostUsed[0].frequency || 1) * 15));
        log(`\n   ${pattern.name}`, 'bold');
        log(`   ${bar} ${pattern.frequency} kullanım, ${(pattern.confidence * 100).toFixed(0)}% güven`, 'dim');
        log(`   Kategori: ${pattern.category}`, 'dim');
        if (pattern.description) {
          log(`   ${truncate(pattern.description, 60)}`, 'dim');
        }
      }

      // Anti-patterns
      log('\n\n🚫 Anti-Pattern Kontrolleri:', 'yellow');
      const sampleCode = 'const x: any = value; console.log(x);';
      const antiPatterns = kb.detectAntiPatterns(sampleCode);
      
      if (antiPatterns.length > 0) {
        log('   Tespit edilen anti-pattern\'lar:', 'reset');
        for (const ap of antiPatterns) {
          log(`   ❌ ${ap.antiPattern.name}: ${ap.antiPattern.solution}`, 'dim');
        }
      } else {
        log('   ✅ Örnek kodda anti-pattern yok', 'green');
      }

      console.log();
      break;
    }

    case 'status': {
      log('\n📊 FuncLib v4 Durum\n', 'cyan');

      const queryEngine = new QueryEngine(PROJECT_PATH);
      const ready = await queryEngine.checkReady();

      log(`   AST Index:      ${ready.indexReady ? '✅' : '❌'} (${ready.symbolCount} sembol)`, 'reset');
      log(`   Vector Store:   ${ready.vectorReady ? '✅' : '❌'} (${ready.vectorCount} vektör)`, 'reset');
      log(`   Knowledge Graph: ${ready.graphReady ? '✅' : '❌'} (${ready.nodeCount} node)`, 'reset');
      log(`   LLM:            ${ready.llmReady ? '✅' : '❌'}`, 'reset');

      if (!ready.indexReady) {
        log('\n   💡 `funclib index` çalıştırın', 'dim');
      } else if (!ready.vectorReady) {
        log('\n   💡 `funclib build-ai` çalıştırın', 'dim');
      } else if (!ready.llmReady) {
        log('\n   💡 `ollama serve` başlatın', 'dim');
      }
      console.log();
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
  }
}

function getKindIcon(kind: string): string {
  const icons: Record<string, string> = {
    'function': '🔧',
    'method': '🔨',
    'class': '📦',
    'interface': '📋',
    'type': '📝',
    'enum': '📊',
    'variable': '📌',
    'constant': '🔒',
    'property': '🏷️',
    'constructor': '🏗️',
    'module': '📁',
    'namespace': '📂',
    'component': '🧩',
    'hook': '🪝',
  };
  return icons[kind] || '•';
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.substring(0, max - 3) + '...';
}

main().catch(err => {
  log(`\n❌ Error: ${err.message}\n`, 'red');
  console.error(err);
  process.exit(1);
});
