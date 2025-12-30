/**
 * Index Manager - Symbol database and search
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import ParserEngine from './parser';
import {
  Symbol,
  SymbolKind,
  Reference,
  FileIndex,
  ProjectIndex,
  ProjectConfig,
  IndexStats,
  SearchOptions,
  SearchResult,
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
  Language,
  RefsResponse,
} from './types';
import { getLanguageByExtension, getSupportedExtensions, DEFAULT_EXCLUDE_DIRS } from './languages';

export class IndexManager {
  private index: ProjectIndex;
  private parser: ParserEngine;
  private indexPath: string;

  constructor(projectPath: string, indexPath?: string) {
    this.parser = new ParserEngine();
    this.indexPath = indexPath || path.join(projectPath, '.funclib', 'index.json');
    
    this.index = {
      version: 2,
      projectPath: path.resolve(projectPath),
      lastIndexed: 0,
      config: {
        name: path.basename(projectPath),
        include: ['**/*'],
        exclude: DEFAULT_EXCLUDE_DIRS.map(d => `**/${d}/**`),
        languages: [],
      },
      stats: this.emptyStats(),
      files: {},
    };
  }

  /**
   * Get the raw index object
   */
  getIndex(): ProjectIndex {
    return this.index;
  }

  /**
   * Get project path
   */
  getProjectPath(): string {
    return this.index.projectPath;
  }

  private emptyStats(): IndexStats {
    return {
      totalFiles: 0,
      totalSymbols: 0,
      totalReferences: 0,
      byLanguage: {} as Record<Language, number>,
      byKind: {} as Record<SymbolKind, number>,
    };
  }

  // ========================
  // Persistence
  // ========================

  load(): boolean {
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        const loaded = JSON.parse(data);
        
        // Version check
        if (loaded.version !== 2) {
          console.log('Index version mismatch, will rebuild');
          return false;
        }
        
        this.index = loaded;
        return true;
      }
    } catch (err) {
      console.error('Failed to load index:', err);
    }
    return false;
  }

  save(): void {
    const dir = path.dirname(this.indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  // ========================
  // Indexing
  // ========================

  async indexProject(options?: { 
    incremental?: boolean;
    onProgress?: (current: number, total: number, file: string) => void;
  }): Promise<{ indexed: number; skipped: number; errors: string[] }> {
    const incremental = options?.incremental ?? true;
    let indexed = 0;
    let skipped = 0;
    const errors: string[] = [];

    await this.parser.initialize();

    // Find all files
    const extensions = getSupportedExtensions();
    const pattern = `**/*{${extensions.join(',')}}`;
    
    const files = await glob(pattern, {
      cwd: this.index.projectPath,
      ignore: this.index.config.exclude,
      absolute: true,
      nodir: true,
    });

    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = path.relative(this.index.projectPath, file);

      options?.onProgress?.(i + 1, total, relativePath);

      // Incremental check
      if (incremental && this.index.files[relativePath]) {
        try {
          const stat = fs.statSync(file);
          const existingIndex = this.index.files[relativePath];
          
          if (stat.mtimeMs <= existingIndex.lastModified) {
            skipped++;
            continue;
          }
        } catch {
          // File might be deleted
        }
      }

      try {
        const fileIndex = await this.parser.parseFile(file);
        
        if (fileIndex) {
          fileIndex.file = relativePath;
          this.index.files[relativePath] = fileIndex;
          indexed++;
        }
      } catch (err) {
        errors.push(`${relativePath}: ${err}`);
      }
    }

    // Remove deleted files
    for (const filePath of Object.keys(this.index.files)) {
      const fullPath = path.join(this.index.projectPath, filePath);
      if (!fs.existsSync(fullPath)) {
        delete this.index.files[filePath];
      }
    }

    // Update stats
    this.updateStats();
    this.index.lastIndexed = Date.now();
    this.save();

    return { indexed, skipped, errors };
  }

  async indexFile(filePath: string): Promise<FileIndex | null> {
    await this.parser.initialize();
    
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.index.projectPath, filePath);
    
    const relativePath = path.relative(this.index.projectPath, fullPath);
    
    try {
      const fileIndex = await this.parser.parseFile(fullPath);
      
      if (fileIndex) {
        fileIndex.file = relativePath;
        this.index.files[relativePath] = fileIndex;
        this.updateStats();
        this.save();
        return fileIndex;
      }
    } catch (err) {
      console.error(`Failed to index ${filePath}:`, err);
    }
    
    return null;
  }

  private updateStats(): void {
    const stats = this.emptyStats();
    
    for (const fileIndex of Object.values(this.index.files)) {
      stats.totalFiles++;
      stats.totalSymbols += fileIndex.symbols.length;
      stats.totalReferences += fileIndex.references.length;
      
      // By language
      stats.byLanguage[fileIndex.language] = 
        (stats.byLanguage[fileIndex.language] || 0) + fileIndex.symbols.length;
      
      // By kind
      for (const symbol of fileIndex.symbols) {
        stats.byKind[symbol.kind] = (stats.byKind[symbol.kind] || 0) + 1;
      }
    }
    
    this.index.stats = stats;
  }

  // ========================
  // Search
  // ========================

  search(options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = options.query.toLowerCase();
    const kindFilter = options.kind ? 
      (Array.isArray(options.kind) ? options.kind : [options.kind]) : null;
    const langFilter = options.language ?
      (Array.isArray(options.language) ? options.language : [options.language]) : null;

    for (const fileIndex of Object.values(this.index.files)) {
      // Language filter
      if (langFilter && !langFilter.includes(fileIndex.language)) continue;

      // File pattern filter
      if (options.file && !fileIndex.file.includes(options.file)) continue;

      for (const symbol of fileIndex.symbols) {
        // Kind filter
        if (kindFilter && !kindFilter.includes(symbol.kind)) continue;

        // Exported filter
        if (options.exported !== undefined && symbol.exported !== options.exported) continue;

        // Match score
        let score = 0;
        const matches: SearchResult['matches'] = [];
        const nameLower = symbol.name.toLowerCase();

        if (options.regex) {
          try {
            const regex = new RegExp(options.query, 'i');
            if (regex.test(symbol.name)) {
              score = 70;
              const match = symbol.name.match(regex);
              if (match && match.index !== undefined) {
                matches.push({
                  field: 'name',
                  indices: [[match.index, match.index + match[0].length]],
                });
              }
            }
          } catch {
            // Invalid regex
          }
        } else if (options.fuzzy !== false) {
          // Fuzzy matching
          if (nameLower === queryLower) {
            score = 100;
          } else if (nameLower.startsWith(queryLower)) {
            score = 90;
          } else if (nameLower.includes(queryLower)) {
            score = 70;
          } else if (this.fuzzyMatch(nameLower, queryLower)) {
            score = 50;
          } else if (symbol.signature && symbol.signature.toLowerCase().includes(queryLower)) {
            score = 30;
            matches.push({ field: 'signature', indices: [] });
          }
        } else {
          // Exact matching
          if (nameLower === queryLower) {
            score = 100;
          }
        }

        if (score > 0) {
          if (matches.length === 0) {
            const idx = nameLower.indexOf(queryLower);
            if (idx >= 0) {
              matches.push({
                field: 'name',
                indices: [[idx, idx + queryLower.length]],
              });
            }
          }

          results.push({ symbol, score, matches });
        }
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    return options.limit ? results.slice(0, options.limit) : results;
  }

  private fuzzyMatch(str: string, pattern: string): boolean {
    let patternIdx = 0;
    for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
      if (str[i] === pattern[patternIdx]) {
        patternIdx++;
      }
    }
    return patternIdx === pattern.length;
  }

  // ========================
  // Symbol Lookup
  // ========================

  getSymbol(name: string): Symbol | null {
    for (const fileIndex of Object.values(this.index.files)) {
      for (const symbol of fileIndex.symbols) {
        if (symbol.name === name) {
          return symbol;
        }
      }
    }
    return null;
  }

  getAllDefinitions(name: string): Symbol[] {
    const results: Symbol[] = [];
    for (const fileIndex of Object.values(this.index.files)) {
      for (const symbol of fileIndex.symbols) {
        if (symbol.name === name) {
          results.push(symbol);
        }
      }
    }
    return results;
  }

  getSymbolsInFile(filePath: string): Symbol[] {
    const normalized = filePath.replace(/\\/g, '/');
    return this.index.files[normalized]?.symbols || [];
  }

  getAllSymbols(): Symbol[] {
    return Object.values(this.index.files).flatMap(f => f.symbols);
  }

  // ========================
  // References
  // ========================

  findReferences(symbolName: string): RefsResponse {
    const definitions = this.getAllDefinitions(symbolName);
    const references: Reference[] = [];

    for (const fileIndex of Object.values(this.index.files)) {
      for (const ref of fileIndex.references) {
        if (ref.symbol === symbolName) {
          references.push(ref);
        }
      }
    }

    return {
      symbol: symbolName,
      definitions,
      references,
      total: definitions.length + references.length,
    };
  }

  // ========================
  // Call Graph
  // ========================

  buildCallGraph(): CallGraph {
    const nodes: CallGraphNode[] = [];
    const edges: CallGraphEdge[] = [];
    const edgeMap = new Map<string, CallGraphEdge>();

    // Create nodes for all symbols
    const symbols = this.getAllSymbols();
    const symbolSet = new Set(symbols.map(s => s.name));

    for (const symbol of symbols) {
      if (symbol.kind === 'function' || symbol.kind === 'method') {
        nodes.push({
          id: `${symbol.file}:${symbol.name}`,
          symbol,
        });
      }
    }

    // Create edges from references
    for (const fileIndex of Object.values(this.index.files)) {
      // Find which function each reference is in
      for (const ref of fileIndex.references) {
        if (ref.kind !== 'call') continue;
        if (!symbolSet.has(ref.symbol)) continue;

        // Find the containing function
        const containingSymbol = this.findContainingSymbol(
          fileIndex.symbols,
          ref.range.start.line
        );

        if (containingSymbol) {
          const fromId = `${fileIndex.file}:${containingSymbol.name}`;
          const toId = ref.symbol; // We'd need full resolution for accuracy

          const edgeKey = `${fromId}->${toId}`;
          
          if (edgeMap.has(edgeKey)) {
            const edge = edgeMap.get(edgeKey)!;
            edge.count++;
            edge.locations.push(ref.range);
          } else {
            const edge: CallGraphEdge = {
              from: fromId,
              to: toId,
              count: 1,
              locations: [ref.range],
            };
            edgeMap.set(edgeKey, edge);
            edges.push(edge);
          }
        }
      }
    }

    return { nodes, edges };
  }

  private findContainingSymbol(symbols: Symbol[], line: number): Symbol | null {
    for (const symbol of symbols) {
      if (symbol.kind === 'function' || symbol.kind === 'method') {
        if (line >= symbol.range.start.line && line <= symbol.range.end.line) {
          return symbol;
        }
      }
    }
    return null;
  }

  // ========================
  // Utilities
  // ========================

  getStats(): IndexStats {
    return this.index.stats;
  }

  getConfig(): ProjectConfig {
    return this.index.config;
  }

  setConfig(config: Partial<ProjectConfig>): void {
    this.index.config = { ...this.index.config, ...config };
    this.save();
  }

  clear(): void {
    this.index.files = {};
    this.index.stats = this.emptyStats();
    this.index.lastIndexed = 0;
    this.save();
  }
}

export default IndexManager;
