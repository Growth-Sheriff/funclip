/**
 * FuncLib v4 - Runtime Collector
 * Test sonuçları, coverage, runtime errors toplar
 */
export interface TestResult {
    id: string;
    name: string;
    file: string;
    suite?: string;
    status: 'passed' | 'failed' | 'skipped' | 'pending';
    duration: number;
    error?: TestError;
    retries: number;
    timestamp: Date;
}
export interface TestError {
    message: string;
    stack?: string;
    expected?: string;
    actual?: string;
    diff?: string;
}
export interface TestSuite {
    name: string;
    file: string;
    tests: TestResult[];
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
}
export interface CoverageMap {
    files: FileCoverage[];
    summary: CoverageSummary;
    timestamp: Date;
}
export interface FileCoverage {
    file: string;
    statements: {
        covered: number;
        total: number;
        percentage: number;
    };
    branches: {
        covered: number;
        total: number;
        percentage: number;
    };
    functions: {
        covered: number;
        total: number;
        percentage: number;
    };
    lines: {
        covered: number;
        total: number;
        percentage: number;
    };
    uncoveredLines: number[];
}
export interface CoverageSummary {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
}
export interface RuntimeError {
    id: string;
    timestamp: Date;
    type: string;
    message: string;
    stack?: string;
    file?: string;
    line?: number;
    column?: number;
    context?: Record<string, any>;
    frequency: number;
    firstSeen: Date;
    lastSeen: Date;
    resolved: boolean;
}
export interface PerformanceTrace {
    id: string;
    name: string;
    duration: number;
    startTime: Date;
    endTime: Date;
    type: 'function' | 'api' | 'render' | 'query' | 'io';
    metadata?: Record<string, any>;
}
export declare class RuntimeCollector {
    private projectPath;
    private testResults;
    private errors;
    private traces;
    private coverage;
    constructor(projectPath: string);
    /**
     * Cached data yükle
     */
    private loadCachedData;
    /**
     * Cache kaydet
     */
    private saveCache;
    /**
     * Test sonuçlarını topla (Jest, Vitest, Mocha destekler)
     */
    collectTestResults(): Promise<TestResult[]>;
    /**
     * Jest sonuçlarını parse et
     */
    private parseJestResults;
    /**
     * Vitest sonuçlarını parse et
     */
    private parseVitestResults;
    /**
     * Coverage raporunu parse et
     */
    private parseCoverageReport;
    /**
     * Coverage verisini getir
     */
    collectCoverage(): CoverageMap | null;
    /**
     * Dosya için coverage getir
     */
    getCoverageForFile(file: string): FileCoverage | null;
    /**
     * Runtime error logla
     */
    logError(error: Omit<RuntimeError, 'id' | 'frequency' | 'firstSeen' | 'lastSeen' | 'resolved'>): void;
    /**
     * Tüm hataları getir
     */
    collectErrors(resolved?: boolean): RuntimeError[];
    /**
     * En sık karşılaşılan hatalar
     */
    getTopErrors(limit?: number): RuntimeError[];
    /**
     * Dosya için hatalar
     */
    getErrorsForFile(file: string): RuntimeError[];
    /**
     * Hatayı resolved olarak işaretle
     */
    resolveError(id: string): void;
    /**
     * Performance trace logla
     */
    logTrace(trace: Omit<PerformanceTrace, 'id'>): void;
    /**
     * Tüm trace'leri getir
     */
    collectTraces(): PerformanceTrace[];
    /**
     * Yavaş fonksiyonları bul
     */
    getSlowTraces(thresholdMs?: number): PerformanceTrace[];
    /**
     * Test summary
     */
    getTestSummary(): {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        coverage: CoverageSummary | null;
    };
    /**
     * Failing testleri getir
     */
    getFailingTests(): TestResult[];
    /**
     * Flaky testleri bul (retry yapılmış)
     */
    getFlakyTests(): TestResult[];
}
export declare function getRuntimeCollector(projectPath: string): RuntimeCollector;
export default RuntimeCollector;
