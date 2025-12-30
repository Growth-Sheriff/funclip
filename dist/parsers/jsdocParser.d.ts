/**
 * FuncLib v4 - JSDoc & Comment Parser
 * Dokümantasyon ve yorum extraction
 */
export interface JSDocInfo {
    description: string;
    params: JSDocParam[];
    returns: JSDocReturn | null;
    throws: JSDocThrows[];
    examples: string[];
    see: string[];
    deprecated: boolean;
    deprecationMessage?: string;
    since?: string;
    author?: string;
    tags: Record<string, string>;
}
export interface JSDocParam {
    name: string;
    type: string;
    description: string;
    optional: boolean;
    defaultValue?: string;
}
export interface JSDocReturn {
    type: string;
    description: string;
}
export interface JSDocThrows {
    type: string;
    description: string;
}
export interface CodeMarker {
    type: 'TODO' | 'FIXME' | 'HACK' | 'NOTE' | 'XXX' | 'BUG' | 'OPTIMIZE';
    text: string;
    line: number;
    author?: string;
    priority?: 'low' | 'medium' | 'high';
}
export interface Comment {
    type: 'line' | 'block' | 'jsdoc';
    text: string;
    line: number;
    endLine: number;
}
export declare class JSDocParser {
    /**
     * JSDoc comment'ini parse et
     */
    parse(comment: string): JSDocInfo;
    /**
     * Kod içindeki marker'ları bul (TODO, FIXME, etc.)
     */
    extractMarkers(content: string): CodeMarker[];
    /**
     * Tüm comment'leri extract et
     */
    extractComments(content: string): Comment[];
    private cleanComment;
    private parseParam;
    private parseReturn;
    private parseThrows;
    private inferPriority;
    private extractAuthor;
    private getLineNumber;
}
export declare function getJSDocParser(): JSDocParser;
export default JSDocParser;
