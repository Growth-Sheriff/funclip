/**
 * Tree-sitter Parser Engine
 * Universal AST parsing for all supported languages
 */
import Parser from 'web-tree-sitter';
import { FileIndex } from './types';
export declare class ParserEngine {
    private parser;
    private languages;
    private wasmDir;
    private initialized;
    constructor(wasmDir?: string);
    initialize(): Promise<void>;
    loadLanguage(lang: string): Promise<Parser.Language | null>;
    parseFile(filePath: string, content?: string): Promise<FileIndex | null>;
    private extractSymbols;
    private extractImports;
    private extractExports;
    private extractReferences;
    private walkTree;
    /**
     * Parse Vue Single File Component (SFC)
     * Extracts script content and parses it as TypeScript/JavaScript
     */
    private parseVueSFC;
    /**
     * Extract script setup macros (defineProps, defineEmits, etc.)
     */
    private extractScriptSetupMacros;
    private hashContent;
}
export default ParserEngine;
