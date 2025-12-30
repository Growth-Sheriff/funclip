/**
 * FuncLib v2 - Universal Type Definitions
 */
export interface Position {
    line: number;
    column: number;
    offset: number;
}
export interface Range {
    start: Position;
    end: Position;
}
export interface Symbol {
    name: string;
    kind: SymbolKind;
    range: Range;
    selectionRange: Range;
    file: string;
    language: Language;
    signature?: string;
    documentation?: string;
    exported?: boolean;
    async?: boolean;
    static?: boolean;
    visibility?: 'public' | 'private' | 'protected';
    parameters?: Parameter[];
    returnType?: string;
    extends?: string;
    implements?: string[];
    parent?: string;
    children?: string[];
}
export type SymbolKind = 'function' | 'method' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'constant' | 'property' | 'constructor' | 'module' | 'namespace' | 'component' | 'hook' | 'decorator' | 'event' | 'unknown';
export interface Parameter {
    name: string;
    type?: string;
    defaultValue?: string;
    rest?: boolean;
    optional?: boolean;
}
export interface Reference {
    symbol: string;
    file: string;
    range: Range;
    context: string;
    kind: ReferenceKind;
}
export type ReferenceKind = 'call' | 'read' | 'write' | 'import' | 'export' | 'type' | 'extends' | 'implements' | 'instantiate' | 'decorator' | 'component-usage' | 'unknown';
export interface Import {
    source: string;
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
    source?: string;
}
export type Language = 'javascript' | 'typescript' | 'tsx' | 'jsx' | 'python' | 'go' | 'rust' | 'java' | 'kotlin' | 'c' | 'cpp' | 'csharp' | 'php' | 'ruby' | 'swift' | 'dart' | 'vue' | 'svelte' | 'html' | 'css' | 'scss' | 'json' | 'yaml' | 'markdown' | 'bash' | 'sql' | 'unknown';
export interface LanguageConfig {
    extensions: string[];
    treeSitterLang: string;
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
export interface FileIndex {
    file: string;
    language: Language;
    hash: string;
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
    include: string[];
    exclude: string[];
    languages: Language[];
}
export interface IndexStats {
    totalFiles: number;
    totalSymbols: number;
    totalReferences: number;
    byLanguage: Record<Language, number>;
    byKind: Record<SymbolKind, number>;
}
export interface SearchOptions {
    query: string;
    kind?: SymbolKind | SymbolKind[];
    language?: Language | Language[];
    file?: string;
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
    indices: [number, number][];
}
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
