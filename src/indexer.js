// src/indexer.js - File scanner and indexer

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { parseFile, findReferences } from './parser.js';
import FuncLibDB from './database.js';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'];
const DEFAULT_IGNORE = ['node_modules', 'dist', 'build', '.next', '.output', 'coverage', '.git'];

export class Indexer {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.extensions = options.extensions || DEFAULT_EXTENSIONS;
    this.ignore = options.ignore || DEFAULT_IGNORE;
    this.dbPath = options.dbPath || path.join(this.rootDir, '.funclib', 'index.db');
    this.db = new FuncLibDB(this.dbPath);
    this.verbose = options.verbose || false;
  }

  log(...args) {
    if (this.verbose) console.log(...args);
  }

  /**
   * Get all matching files
   */
  async getFiles() {
    const patterns = this.extensions.map(ext => `**/*${ext}`);
    const ignorePatterns = this.ignore.map(p => `**/${p}/**`);
    
    const files = await glob(patterns, {
      cwd: this.rootDir,
      ignore: ignorePatterns,
      absolute: false,
      nodir: true
    });
    
    return files;
  }

  /**
   * Check if file needs reindexing
   */
  needsReindex(filePath) {
    const fullPath = path.join(this.rootDir, filePath);
    const stats = fs.statSync(fullPath);
    const mtime = stats.mtimeMs;
    
    const cached = this.db.getFileInfo(filePath);
    if (!cached) return true;
    
    return cached.mtime < mtime;
  }

  /**
   * Index a single file
   */
  indexFile(filePath) {
    const fullPath = path.join(this.rootDir, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const stats = fs.statSync(fullPath);
    
    // Parse functions
    const functions = parseFile(content, filePath);
    
    // Clear old data for this file
    this.db.removeFile(filePath);
    
    // Insert new functions
    if (functions.length > 0) {
      this.db.insertFunctions(functions);
    }
    
    // Update file tracking
    this.db.updateFileInfo(filePath, stats.mtimeMs);
    
    return functions.length;
  }

  /**
   * Index all references after functions are indexed
   */
  indexReferences() {
    const allFunctions = this.db.getAllFunctions();
    const functionNames = new Set(allFunctions.map(f => f.name));
    
    // Get unique files
    const files = [...new Set(allFunctions.map(f => f.file_path))];
    
    let totalRefs = 0;
    
    for (const filePath of files) {
      const fullPath = path.join(this.rootDir, filePath);
      if (!fs.existsSync(fullPath)) continue;
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Clear old refs for this file
      this.db.clearRefsForFile(filePath);
      
      // Find all references
      for (const funcName of functionNames) {
        const refs = findReferences(content, funcName, filePath);
        
        if (refs.length > 0) {
          this.db.insertRefs(refs.map(r => ({
            functionName: funcName,
            filePath: r.filePath,
            line: r.line,
            column: r.column,
            context: r.context
          })));
          totalRefs += refs.length;
        }
      }
    }
    
    return totalRefs;
  }

  /**
   * Full reindex
   */
  async indexAll(options = {}) {
    const startTime = Date.now();
    const force = options.force || false;
    
    this.log('🔍 Scanning files...');
    const files = await this.getFiles();
    this.log(`   Found ${files.length} files`);
    
    let indexed = 0;
    let skipped = 0;
    let totalFunctions = 0;
    
    for (const file of files) {
      if (!force && !this.needsReindex(file)) {
        skipped++;
        continue;
      }
      
      try {
        const count = this.indexFile(file);
        totalFunctions += count;
        indexed++;
        this.log(`   ✓ ${file} (${count} functions)`);
      } catch (err) {
        console.error(`   ✗ ${file}: ${err.message}`);
      }
    }
    
    // Index references
    this.log('🔗 Indexing references...');
    const refCount = this.indexReferences();
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    return {
      files: files.length,
      indexed,
      skipped,
      functions: totalFunctions,
      references: refCount,
      elapsed: `${elapsed}s`
    };
  }

  /**
   * Search functions
   */
  search(query, options = {}) {
    if (options.exact) {
      return this.db.searchByName(query, true);
    }
    if (options.fts) {
      return this.db.searchFTS(query);
    }
    return this.db.searchByName(query, false);
  }

  /**
   * Get all references to a function
   */
  refs(functionName) {
    return this.db.getAllReferences(functionName);
  }

  /**
   * Get stats
   */
  stats() {
    return this.db.getStats();
  }

  /**
   * Export to JSON
   */
  export() {
    return this.db.exportJSON();
  }

  /**
   * List all files
   */
  listFiles() {
    return this.db.listFiles();
  }

  /**
   * Get functions in a file
   */
  getFunctionsInFile(filePath) {
    return this.db.getFunctionsByFile(filePath);
  }

  close() {
    this.db.close();
  }
}

export default Indexer;
