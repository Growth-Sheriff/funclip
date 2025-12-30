/**
 * FuncLib v4 - Temporal Memory
 * Sembol ve dosya değişiklik geçmişini takip eder
 */
export interface SymbolTimeline {
    symbol: string;
    events: SymbolEvent[];
    metrics: SymbolTimelineMetrics;
}
export interface SymbolEvent {
    timestamp: Date;
    type: 'created' | 'modified' | 'renamed' | 'moved' | 'deleted';
    author: string;
    commit: string;
    message: string;
    file: string;
    line?: number;
}
export interface SymbolTimelineMetrics {
    totalChanges: number;
    avgChangeFrequency: number;
    stabilityScore: number;
    hotspotScore: number;
    lastModified: Date;
    firstSeen: Date;
    authors: string[];
}
export interface FileTimeline {
    file: string;
    events: FileEvent[];
    metrics: FileTimelineMetrics;
}
export interface FileEvent {
    timestamp: Date;
    type: 'created' | 'modified' | 'renamed' | 'deleted';
    author: string;
    commit: string;
    message: string;
    insertions: number;
    deletions: number;
}
export interface FileTimelineMetrics {
    totalChanges: number;
    avgChangeSize: number;
    churnRate: number;
    stabilityScore: number;
    hotspotScore: number;
    lastModified: Date;
    authors: string[];
}
export interface TrendReport {
    period: {
        start: Date;
        end: Date;
    };
    mostChanged: Array<{
        file: string;
        changes: number;
    }>;
    mostActive: Array<{
        author: string;
        commits: number;
    }>;
    bugFixTrend: Array<{
        week: string;
        count: number;
    }>;
    complexityTrend: Array<{
        week: string;
        avgComplexity: number;
    }>;
}
export interface Anomaly {
    type: 'sudden_change' | 'unusual_author' | 'large_commit' | 'late_night_commit';
    file?: string;
    commit: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
}
export declare class TemporalMemory {
    private projectPath;
    private gitCollector;
    private dataPath;
    private symbolHistory;
    private fileHistory;
    constructor(projectPath: string);
    /**
     * Sembol geçmişini takip et
     */
    trackSymbol(symbolName: string): SymbolTimeline;
    /**
     * Dosya geçmişini takip et
     */
    trackFile(file: string): FileTimeline;
    /**
     * Trend analizi
     */
    analyzeTrends(): TrendReport;
    /**
     * Anomali tespiti
     */
    detectAnomalies(): Anomaly[];
    /**
     * En sık değişen semboller
     */
    getVolatileSymbols(limit?: number): Array<{
        symbol: string;
        changes: number;
        score: number;
    }>;
    /**
     * En stabil semboller
     */
    getStableSymbols(limit?: number): Array<{
        symbol: string;
        daysSinceChange: number;
        score: number;
    }>;
    save(): void;
    load(): boolean;
    clear(): void;
    private calculateSymbolMetrics;
    private calculateFileMetrics;
    private calculateWeeklyBugFixes;
    private getWeekStart;
}
export declare function getTemporalMemory(projectPath: string): TemporalMemory;
export default TemporalMemory;
