/**
 * Index Manager - Symbol database and search
 */
import { Symbol, FileIndex, ProjectIndex, ProjectConfig, IndexStats, SearchOptions, SearchResult, CallGraph, RefsResponse } from './types';
export declare class IndexManager {
    private index;
    private parser;
    private indexPath;
    constructor(projectPath: string, indexPath?: string);
    /**
     * Get the raw index object
     */
    getIndex(): ProjectIndex;
    /**
     * Get project path
     */
    getProjectPath(): string;
    private emptyStats;
    load(): boolean;
    save(): void;
    indexProject(options?: {
        incremental?: boolean;
        onProgress?: (current: number, total: number, file: string) => void;
    }): Promise<{
        indexed: number;
        skipped: number;
        errors: string[];
    }>;
    indexFile(filePath: string): Promise<FileIndex | null>;
    private updateStats;
    search(options: SearchOptions): SearchResult[];
    private fuzzyMatch;
    getSymbol(name: string): Symbol | null;
    getAllDefinitions(name: string): Symbol[];
    getSymbolsInFile(filePath: string): Symbol[];
    getAllSymbols(): Symbol[];
    findReferences(symbolName: string): RefsResponse;
    buildCallGraph(): CallGraph;
    private findContainingSymbol;
    getStats(): IndexStats;
    getConfig(): ProjectConfig;
    setConfig(config: Partial<ProjectConfig>): void;
    clear(): void;
}
export default IndexManager;
