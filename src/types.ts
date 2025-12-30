/**
 * FuncLib v2 - Universal Type Definitions
 */

// ========================
// Core Types
// ========================

export interface Position {
  line: number;      // 1-indexed
  column: number;    // 0-indexed
  offset: number;    // byte offset
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Symbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;  // just the name part
  file: string;
  language: Language;
  
  // Optional metadata
  signature?: string;
  documentation?: string;
  exported?: boolean;
  async?: boolean;
  static?: boolean;
  visibility?: 'public' | 'private' | 'protected';
  
  // For functions/methods
  parameters?: Parameter[];
  returnType?: string;
  
  // For classes
  extends?: string;
  implements?: string[];
  
  // Relations
  parent?: string;       // parent symbol name (e.g., class name for method)
  children?: string[];   // child symbols
}

export type SymbolKind = 
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'constant'
  | 'property'
  | 'constructor'
  | 'module'
  | 'namespace'
  | 'component'    // React/Vue components
  | 'hook'         // React hooks / Vue composables
  | 'decorator'
  | 'event'        // Vue emits / custom events
  | 'unknown';

export interface Parameter {
  name: string;
  type?: string;
  defaultValue?: string;
  rest?: boolean;       // ...args
  optional?: boolean;
}

export interface Reference {
  symbol: string;       // referenced symbol name
  file: string;
  range: Range;
  context: string;      // surrounding code
  kind: ReferenceKind;
}

export type ReferenceKind = 
  | 'call'           // function call
  | 'read'           // variable read
  | 'write'          // variable write
  | 'import'         // import statement
  | 'export'         // export statement
  | 'type'           // type reference
  | 'extends'        // class extends
  | 'implements'     // implements interface
  | 'instantiate'    // new ClassName()
  | 'decorator'      // @decorator
  | 'component-usage' // Vue component usage in template
  | 'unknown';

export interface Import {
  source: string;       // module path
  file: string;
  range: Range;
  specifiers: ImportSpecifier[];
  kind: 'named' | 'default' | 'namespace' | 'side-effect';
}

export interface ImportSpecifier {
  name: string;
  alias?: string;
  isDefault?: boolean;
  isNamespace?: boolean;
}

export interface Export {
  name: string;
  file: string;
  range: Range;
  kind: 'named' | 'default' | 're-export';
  source?: string;      // for re-exports
}

// ========================
// Language Support
// ========================

export type Language = 
  | 'javascript'
  | 'typescript'
  | 'tsx'
  | 'jsx'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'kotlin'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'dart'
  | 'vue'
  | 'svelte'
  | 'html'
  | 'css'
  | 'scss'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'bash'
  | 'sql'
  | 'unknown';

export interface LanguageConfig {
  extensions: string[];
  treeSitterLang: string;    // tree-sitter grammar name
  queries: LanguageQueries;
}

export interface LanguageQueries {
  functions?: string;
  classes?: string;
  methods?: string;
  variables?: string;
  imports?: string;
  exports?: string;
  calls?: string;
}

// ========================
// Index Types
// ========================

export interface FileIndex {
  file: string;
  language: Language;
  hash: string;           // content hash for incremental indexing
  lastModified: number;
  symbols: Symbol[];
  imports: Import[];
  exports: Export[];
  references: Reference[];
}

export interface ProjectIndex {
  version: number;
  projectPath: string;
  lastIndexed: number;
  config: ProjectConfig;
  stats: IndexStats;
  files: Record<string, FileIndex>;
}

export interface ProjectConfig {
  name: string;
  include: string[];      // glob patterns
  exclude: string[];      // glob patterns
  languages: Language[];
}

export interface IndexStats {
  totalFiles: number;
  totalSymbols: number;
  totalReferences: number;
  byLanguage: Record<Language, number>;
  byKind: Record<SymbolKind, number>;
}

// ========================
// Search Types
// ========================

export interface SearchOptions {
  query: string;
  kind?: SymbolKind | SymbolKind[];
  language?: Language | Language[];
  file?: string;          // filter by file pattern
  exported?: boolean;
  limit?: number;
  fuzzy?: boolean;
  regex?: boolean;
}

export interface SearchResult {
  symbol: Symbol;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  field: 'name' | 'signature' | 'file';
  indices: [number, number][];  // matched character ranges
}

// ========================
// Graph Types
// ========================

export interface CallGraph {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
}

export interface CallGraphNode {
  id: string;
  symbol: Symbol;
}

export interface CallGraphEdge {
  from: string;
  to: string;
  count: number;
  locations: Range[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  file: string;
  isExternal: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  imports: string[];
}

// ========================
// API Types
// ========================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timing?: number;
}

export interface IndexResponse {
  indexed: number;
  skipped: number;
  errors: string[];
  stats: IndexStats;
}

export interface RefsResponse {
  symbol: string;
  definitions: Symbol[];
  references: Reference[];
  total: number;
}
