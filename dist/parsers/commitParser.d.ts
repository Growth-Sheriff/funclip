/**
 * FuncLib v4 - Commit Parser
 * Conventional commits parsing, intent extraction
 */
export interface ConventionalCommit {
    type: string;
    scope?: string;
    description: string;
    body?: string;
    footer?: string;
    breaking: boolean;
    breakingDescription?: string;
    raw: string;
}
export interface CommitIntent {
    type: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'chore' | 'perf' | 'style' | 'ci' | 'build' | 'revert' | 'unknown';
    scope: string;
    summary: string;
    affectedSymbols: string[];
    affectedFiles: string[];
    confidence: number;
    isBreaking: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
}
export interface IssueRef {
    type: 'fixes' | 'closes' | 'resolves' | 'references' | 'relates';
    issueNumber: number;
    repository?: string;
}
export interface BreakingChange {
    description: string;
    affectedAreas: string[];
    migrationNotes?: string;
}
export declare class CommitParser {
    /**
     * Conventional commit parse et
     */
    parseConventional(message: string): ConventionalCommit;
    /**
     * Commit intent'ini çıkar
     */
    extractIntent(message: string, changedFiles?: string[]): CommitIntent;
    /**
     * Issue referanslarını çıkar
     */
    extractIssueRefs(message: string): IssueRef[];
    /**
     * Breaking change'leri tespit et
     */
    detectBreakingChanges(message: string, diff?: string): BreakingChange[];
    /**
     * Birden fazla commit'i analiz et
     */
    analyzeCommitHistory(messages: string[]): {
        types: Record<string, number>;
        topContributors: string[];
        breakingChanges: number;
        avgCommitSize: number;
    };
    /**
     * Type infer et (conventional format değilse)
     */
    private inferType;
    /**
     * Scope infer et
     */
    private inferScope;
    /**
     * Affected symbols çıkar
     */
    private extractAffectedSymbols;
    /**
     * Confidence hesapla
     */
    private calculateConfidence;
    /**
     * Priority hesapla
     */
    private calculatePriority;
    /**
     * Affected areas çıkar
     */
    private extractAffectedAreas;
    /**
     * Breaking patterns bul (diff'ten)
     */
    private findBreakingPatterns;
}
export declare function getCommitParser(): CommitParser;
export default CommitParser;
