// src/index.js - Main entry point

export { Indexer } from './indexer.js';
export { FuncLibDB } from './database.js';
export { parseFile, findReferences } from './parser.js';
export { createServer } from './server.js';

// Default export: start server
import { createServer } from './server.js';

const server = createServer();
server.indexer.indexAll().then(() => {
  server.start();
});
