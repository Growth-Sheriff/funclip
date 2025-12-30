// src/database.js - SQLite database for function indexing

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class FuncLibDB {
  constructor(dbPath = '.funclib/index.db') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.init();
  }

  init() {
    this.db.exec(`
      -- Functions table
      CREATE TABLE IF NOT EXISTS functions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        params TEXT,
        signature TEXT NOT NULL,
        body TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line_start INTEGER NOT NULL,
        line_end INTEGER NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        is_exported INTEGER DEFAULT 0,
        is_async INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_path, name, line_start)
      );

      -- References table (function calls)
      CREATE TABLE IF NOT EXISTS refs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        function_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line INTEGER NOT NULL,
        column_num INTEGER NOT NULL,
        context TEXT,
        UNIQUE(function_name, file_path, line, column_num)
      );

      -- File tracking (for incremental updates)
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        hash TEXT
      );

      -- Indexes for fast search
      CREATE INDEX IF NOT EXISTS idx_func_name ON functions(name);
      CREATE INDEX IF NOT EXISTS idx_func_file ON functions(file_path);
      CREATE INDEX IF NOT EXISTS idx_refs_name ON refs(function_name);
      CREATE INDEX IF NOT EXISTS idx_refs_file ON refs(file_path);

      -- Full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS functions_fts USING fts5(
        name, signature, body, file_path,
        content='functions',
        content_rowid='id'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS functions_ai AFTER INSERT ON functions BEGIN
        INSERT INTO functions_fts(rowid, name, signature, body, file_path)
        VALUES (new.id, new.name, new.signature, new.body, new.file_path);
      END;

      CREATE TRIGGER IF NOT EXISTS functions_ad AFTER DELETE ON functions BEGIN
        INSERT INTO functions_fts(functions_fts, rowid, name, signature, body, file_path)
        VALUES ('delete', old.id, old.name, old.signature, old.body, old.file_path);
      END;

      CREATE TRIGGER IF NOT EXISTS functions_au AFTER UPDATE ON functions BEGIN
        INSERT INTO functions_fts(functions_fts, rowid, name, signature, body, file_path)
        VALUES ('delete', old.id, old.name, old.signature, old.body, old.file_path);
        INSERT INTO functions_fts(rowid, name, signature, body, file_path)
        VALUES (new.id, new.name, new.signature, new.body, new.file_path);
      END;
    `);
  }

  // ============ FILE TRACKING ============
  
  getFileInfo(filePath) {
    return this.db.prepare('SELECT * FROM files WHERE path = ?').get(filePath);
  }

  updateFileInfo(filePath, mtime, hash = null) {
    this.db.prepare(`
      INSERT OR REPLACE INTO files (path, mtime, hash) VALUES (?, ?, ?)
    `).run(filePath, mtime, hash);
  }

  removeFile(filePath) {
    this.db.prepare('DELETE FROM functions WHERE file_path = ?').run(filePath);
    this.db.prepare('DELETE FROM refs WHERE file_path = ?').run(filePath);
    this.db.prepare('DELETE FROM files WHERE path = ?').run(filePath);
  }

  // ============ FUNCTIONS ============

  insertFunction(func) {
    return this.db.prepare(`
      INSERT OR REPLACE INTO functions 
      (name, type, params, signature, body, file_path, line_start, line_end, 
       char_start, char_end, is_exported, is_async, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      func.name, func.type, func.params, func.signature, func.body,
      func.filePath, func.lineStart, func.lineEnd,
      func.charStart, func.charEnd,
      func.isExported ? 1 : 0, func.isAsync ? 1 : 0
    );
  }

  insertFunctions(functions) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO functions 
      (name, type, params, signature, body, file_path, line_start, line_end,
       char_start, char_end, is_exported, is_async, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const tx = this.db.transaction((funcs) => {
      for (const f of funcs) {
        insert.run(
          f.name, f.type, f.params, f.signature, f.body,
          f.filePath, f.lineStart, f.lineEnd,
          f.charStart, f.charEnd,
          f.isExported ? 1 : 0, f.isAsync ? 1 : 0
        );
      }
    });

    tx(functions);
  }

  // ============ REFERENCES ============

  insertRef(ref) {
    return this.db.prepare(`
      INSERT OR IGNORE INTO refs (function_name, file_path, line, column_num, context)
      VALUES (?, ?, ?, ?, ?)
    `).run(ref.functionName, ref.filePath, ref.line, ref.column, ref.context);
  }

  insertRefs(refs) {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO refs (function_name, file_path, line, column_num, context)
      VALUES (?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((r) => {
      for (const ref of r) {
        insert.run(ref.functionName, ref.filePath, ref.line, ref.column, ref.context);
      }
    });

    tx(refs);
  }

  clearRefsForFile(filePath) {
    this.db.prepare('DELETE FROM refs WHERE file_path = ?').run(filePath);
  }

  // ============ SEARCH ============

  searchByName(name, exact = false) {
    if (exact) {
      return this.db.prepare(`
        SELECT * FROM functions WHERE name = ? ORDER BY file_path, line_start
      `).all(name);
    }
    return this.db.prepare(`
      SELECT * FROM functions WHERE name LIKE ? ORDER BY file_path, line_start
    `).all(`%${name}%`);
  }

  searchFTS(query) {
    return this.db.prepare(`
      SELECT f.* FROM functions f
      JOIN functions_fts fts ON f.id = fts.rowid
      WHERE functions_fts MATCH ?
      ORDER BY rank
    `).all(query);
  }

  getReferences(functionName) {
    return this.db.prepare(`
      SELECT * FROM refs WHERE function_name = ? ORDER BY file_path, line
    `).all(functionName);
  }

  getAllReferences(functionName) {
    // Get both definition and all call sites
    const definitions = this.searchByName(functionName, true);
    const refs = this.getReferences(functionName);
    
    return {
      definitions,
      references: refs,
      totalCount: definitions.length + refs.length
    };
  }

  // ============ STATS ============

  getStats() {
    const funcCount = this.db.prepare('SELECT COUNT(*) as count FROM functions').get();
    const fileCount = this.db.prepare('SELECT COUNT(DISTINCT file_path) as count FROM functions').get();
    const refCount = this.db.prepare('SELECT COUNT(*) as count FROM refs').get();
    const exportedCount = this.db.prepare('SELECT COUNT(*) as count FROM functions WHERE is_exported = 1').get();
    const asyncCount = this.db.prepare('SELECT COUNT(*) as count FROM functions WHERE is_async = 1').get();
    
    return {
      functions: funcCount.count,
      files: fileCount.count,
      references: refCount.count,
      exported: exportedCount.count,
      async: asyncCount.count
    };
  }

  getAllFunctions() {
    return this.db.prepare('SELECT * FROM functions ORDER BY file_path, line_start').all();
  }

  getFunctionsByFile(filePath) {
    return this.db.prepare(`
      SELECT * FROM functions WHERE file_path = ? ORDER BY line_start
    `).all(filePath);
  }

  listFiles() {
    return this.db.prepare('SELECT DISTINCT file_path FROM functions ORDER BY file_path').all();
  }

  // ============ EXPORT ============

  exportJSON() {
    const functions = this.getAllFunctions();
    const stats = this.getStats();
    
    return {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      stats,
      functions: functions.map(f => ({
        name: f.name,
        type: f.type,
        params: f.params,
        signature: f.signature,
        file: f.file_path,
        lines: [f.line_start, f.line_end],
        exported: !!f.is_exported,
        async: !!f.is_async
      }))
    };
  }

  close() {
    this.db.close();
  }
}

export default FuncLibDB;
