"use strict";
/**
 * FuncLib v4 - Runtime Collector
 * Test sonuçları, coverage, runtime errors toplar
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeCollector = void 0;
exports.getRuntimeCollector = getRuntimeCollector;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RuntimeCollector {
    projectPath;
    testResults = [];
    errors = [];
    traces = [];
    coverage = null;
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.loadCachedData();
    }
    /**
     * Cached data yükle
     */
    loadCachedData() {
        try {
            const cachePath = path.join(this.projectPath, '.funclib', 'runtime-cache.json');
            if (fs.existsSync(cachePath)) {
                const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
                this.errors = (data.errors || []).map((e) => ({
                    ...e,
                    timestamp: new Date(e.timestamp),
                    firstSeen: new Date(e.firstSeen),
                    lastSeen: new Date(e.lastSeen),
                }));
            }
        }
        catch {
            // Ignore
        }
    }
    /**
     * Cache kaydet
     */
    saveCache() {
        try {
            const cachePath = path.join(this.projectPath, '.funclib', 'runtime-cache.json');
            const dir = path.dirname(cachePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(cachePath, JSON.stringify({
                errors: this.errors,
                lastUpdated: new Date().toISOString(),
            }, null, 2));
        }
        catch {
            // Ignore
        }
    }
    /**
     * Test sonuçlarını topla (Jest, Vitest, Mocha destekler)
     */
    async collectTestResults() {
        const results = [];
        // Jest JSON output
        const jestPath = path.join(this.projectPath, 'test-results.json');
        if (fs.existsSync(jestPath)) {
            const jestResults = this.parseJestResults(jestPath);
            results.push(...jestResults);
        }
        // Vitest JSON output
        const vitestPath = path.join(this.projectPath, 'vitest-results.json');
        if (fs.existsSync(vitestPath)) {
            const vitestResults = this.parseVitestResults(vitestPath);
            results.push(...vitestResults);
        }
        // Coverage directory check
        const coverageDir = path.join(this.projectPath, 'coverage');
        if (fs.existsSync(coverageDir)) {
            this.coverage = this.parseCoverageReport(coverageDir);
        }
        this.testResults = results;
        return results;
    }
    /**
     * Jest sonuçlarını parse et
     */
    parseJestResults(filePath) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const results = [];
            for (const suite of data.testResults || []) {
                for (const test of suite.assertionResults || []) {
                    results.push({
                        id: `jest_${results.length}`,
                        name: test.title,
                        file: suite.name,
                        suite: test.ancestorTitles?.join(' > '),
                        status: test.status,
                        duration: test.duration || 0,
                        error: test.failureMessages?.length > 0 ? {
                            message: test.failureMessages[0],
                        } : undefined,
                        retries: 0,
                        timestamp: new Date(data.startTime),
                    });
                }
            }
            return results;
        }
        catch {
            return [];
        }
    }
    /**
     * Vitest sonuçlarını parse et
     */
    parseVitestResults(filePath) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const results = [];
            for (const file of data.testResults || []) {
                for (const task of file.tasks || []) {
                    results.push({
                        id: `vitest_${results.length}`,
                        name: task.name,
                        file: file.name,
                        suite: task.suite,
                        status: task.result?.state || 'pending',
                        duration: task.result?.duration || 0,
                        error: task.result?.errors?.[0] ? {
                            message: task.result.errors[0].message,
                            stack: task.result.errors[0].stack,
                        } : undefined,
                        retries: task.retry || 0,
                        timestamp: new Date(),
                    });
                }
            }
            return results;
        }
        catch {
            return [];
        }
    }
    /**
     * Coverage raporunu parse et
     */
    parseCoverageReport(coverageDir) {
        try {
            const summaryPath = path.join(coverageDir, 'coverage-summary.json');
            if (!fs.existsSync(summaryPath))
                return null;
            const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
            const files = [];
            for (const [filePath, coverage] of Object.entries(data)) {
                if (filePath === 'total')
                    continue;
                const cov = coverage;
                files.push({
                    file: filePath,
                    statements: {
                        covered: cov.statements?.covered || 0,
                        total: cov.statements?.total || 0,
                        percentage: cov.statements?.pct || 0,
                    },
                    branches: {
                        covered: cov.branches?.covered || 0,
                        total: cov.branches?.total || 0,
                        percentage: cov.branches?.pct || 0,
                    },
                    functions: {
                        covered: cov.functions?.covered || 0,
                        total: cov.functions?.total || 0,
                        percentage: cov.functions?.pct || 0,
                    },
                    lines: {
                        covered: cov.lines?.covered || 0,
                        total: cov.lines?.total || 0,
                        percentage: cov.lines?.pct || 0,
                    },
                    uncoveredLines: [],
                });
            }
            const total = data.total || {};
            return {
                files,
                summary: {
                    statements: total.statements?.pct || 0,
                    branches: total.branches?.pct || 0,
                    functions: total.functions?.pct || 0,
                    lines: total.lines?.pct || 0,
                },
                timestamp: new Date(),
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Coverage verisini getir
     */
    collectCoverage() {
        return this.coverage;
    }
    /**
     * Dosya için coverage getir
     */
    getCoverageForFile(file) {
        if (!this.coverage)
            return null;
        const relativePath = path.relative(this.projectPath, file);
        return this.coverage.files.find(f => f.file.includes(relativePath) || relativePath.includes(f.file)) || null;
    }
    /**
     * Runtime error logla
     */
    logError(error) {
        const existingIndex = this.errors.findIndex(e => e.type === error.type &&
            e.message === error.message &&
            e.file === error.file);
        if (existingIndex >= 0) {
            this.errors[existingIndex].frequency++;
            this.errors[existingIndex].lastSeen = error.timestamp;
        }
        else {
            this.errors.push({
                ...error,
                id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                frequency: 1,
                firstSeen: error.timestamp,
                lastSeen: error.timestamp,
                resolved: false,
            });
        }
        this.saveCache();
    }
    /**
     * Tüm hataları getir
     */
    collectErrors(resolved = false) {
        return this.errors.filter(e => e.resolved === resolved);
    }
    /**
     * En sık karşılaşılan hatalar
     */
    getTopErrors(limit = 10) {
        return [...this.errors]
            .filter(e => !e.resolved)
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, limit);
    }
    /**
     * Dosya için hatalar
     */
    getErrorsForFile(file) {
        const relativePath = path.relative(this.projectPath, file);
        return this.errors.filter(e => e.file === file || e.file === relativePath);
    }
    /**
     * Hatayı resolved olarak işaretle
     */
    resolveError(id) {
        const error = this.errors.find(e => e.id === id);
        if (error) {
            error.resolved = true;
            this.saveCache();
        }
    }
    /**
     * Performance trace logla
     */
    logTrace(trace) {
        this.traces.push({
            ...trace,
            id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        // Son 1000 trace'i tut
        if (this.traces.length > 1000) {
            this.traces = this.traces.slice(-1000);
        }
    }
    /**
     * Tüm trace'leri getir
     */
    collectTraces() {
        return this.traces;
    }
    /**
     * Yavaş fonksiyonları bul
     */
    getSlowTraces(thresholdMs = 100) {
        return this.traces
            .filter(t => t.duration > thresholdMs)
            .sort((a, b) => b.duration - a.duration);
    }
    /**
     * Test summary
     */
    getTestSummary() {
        const passed = this.testResults.filter(t => t.status === 'passed').length;
        const failed = this.testResults.filter(t => t.status === 'failed').length;
        const skipped = this.testResults.filter(t => t.status === 'skipped').length;
        return {
            total: this.testResults.length,
            passed,
            failed,
            skipped,
            coverage: this.coverage?.summary || null,
        };
    }
    /**
     * Failing testleri getir
     */
    getFailingTests() {
        return this.testResults.filter(t => t.status === 'failed');
    }
    /**
     * Flaky testleri bul (retry yapılmış)
     */
    getFlakyTests() {
        return this.testResults.filter(t => t.retries > 0);
    }
}
exports.RuntimeCollector = RuntimeCollector;
// Singleton
let runtimeCollector = null;
function getRuntimeCollector(projectPath) {
    if (!runtimeCollector || runtimeCollector['projectPath'] !== projectPath) {
        runtimeCollector = new RuntimeCollector(projectPath);
    }
    return runtimeCollector;
}
exports.default = RuntimeCollector;
//# sourceMappingURL=runtimeCollector.js.map