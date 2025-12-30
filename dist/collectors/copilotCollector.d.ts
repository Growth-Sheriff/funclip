/**
 * FuncLib v4 - Copilot Action Collector
 * VS Code'dan Copilot aksiyonlarını yakalar ve loglar
 */
export interface CopilotAction {
    id: string;
    timestamp: Date;
    type: 'suggest' | 'accept' | 'reject' | 'modify' | 'partial_accept';
    file: string;
    line: number;
    column: number;
    originalCode: string;
    suggestedCode: string;
    finalCode?: string;
    language: string;
    context: CopilotContext;
    metadata: CopilotMetadata;
}
export interface CopilotContext {
    surroundingCode: string;
    openFiles: string[];
    recentCommands: string[];
    cursorPosition: {
        line: number;
        column: number;
    };
    selection?: string;
    triggerKind: 'automatic' | 'manual' | 'inline';
}
export interface CopilotMetadata {
    model?: string;
    completionId?: string;
    latency?: number;
    promptTokens?: number;
    completionTokens?: number;
}
export interface CopilotSuggestion {
    id: string;
    text: string;
    range: {
        start: number;
        end: number;
    };
    confidence: number;
    source: 'copilot' | 'copilot-chat' | 'copilot-edits';
}
export interface AcceptanceStats {
    total: number;
    accepted: number;
    rejected: number;
    modified: number;
    partialAccepted: number;
    acceptanceRate: number;
    avgLatency: number;
    byLanguage: Record<string, {
        accepted: number;
        total: number;
    }>;
    byHour: Record<number, {
        accepted: number;
        total: number;
    }>;
}
export interface ParsedChange {
    type: 'add' | 'modify' | 'delete' | 'refactor';
    affectedSymbols: string[];
    linesChanged: number;
    complexity: 'simple' | 'moderate' | 'complex';
}
export declare class CopilotCollector {
    private projectPath;
    private logPath;
    private actions;
    private isWatching;
    constructor(projectPath: string);
    /**
     * Copilot aksiyonlarını yükle
     */
    private load;
    /**
     * Kaydet
     */
    private save;
    /**
     * Yeni aksiyon logla
     */
    logAction(action: Omit<CopilotAction, 'id' | 'timestamp'>): CopilotAction;
    /**
     * Suggestion logla
     */
    logSuggestion(suggestion: CopilotSuggestion, file: string, line: number): void;
    /**
     * Accept logla
     */
    logAccept(file: string, line: number, originalCode: string, acceptedCode: string): void;
    /**
     * Reject logla
     */
    logReject(file: string, line: number, rejectedCode: string): void;
    /**
     * Kabul/red istatistikleri
     */
    getAcceptanceStats(days?: number): AcceptanceStats;
    /**
     * Son aksiyonları getir
     */
    getRecentActions(limit?: number): CopilotAction[];
    /**
     * Dosya için aksiyonları getir
     */
    getActionsForFile(file: string): CopilotAction[];
    /**
     * Copilot değişikliklerini parse et
     */
    parseCopilotChanges(diff: string): ParsedChange[];
    /**
     * Pattern çıkar
     */
    extractPatterns(): Array<{
        trigger: string;
        suggestion: string;
        count: number;
    }>;
    private extractTrigger;
    private detectLanguage;
    private generateId;
}
export declare function getCopilotCollector(projectPath: string): CopilotCollector;
export default CopilotCollector;
