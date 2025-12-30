/**
 * FuncLib v4 - Runtime Collector
 * Test sonuçları, coverage, runtime errors toplar
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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
  statements: { covered: number; total: number; percentage: number };
  branches: { covered: number; total: number; percentage: number };
  functions: { covered: number; total: number; percentage: number };
  lines: { covered: number; total: number; percentage: number };
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

export class RuntimeCollector {
  private projectPath: string;
  private testResults: TestResult[] = [];
  private errors: RuntimeError[] = [];
  private traces: PerformanceTrace[] = [];
  private coverage: CoverageMap | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadCachedData();
  }

  /**
   * Cached data yükle
   */
  private loadCachedData(): void {
    try {
      const cachePath = path.join(this.projectPath, '.funclib', 'runtime-cache.json');
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        this.errors = (data.errors || []).map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
          firstSeen: new Date(e.firstSeen),
          lastSeen: new Date(e.lastSeen),
        }));
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Cache kaydet
   */
  private saveCache(): void {
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
    } catch {
      // Ignore
    }
  }

  /**
   * Test sonuçlarını topla (Jest, Vitest, Mocha destekler)
   */
  async collectTestResults(): Promise<TestResult[]> {
    const results: TestResult[] = [];

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
  private parseJestResults(filePath: string): TestResult[] {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const results: TestResult[] = [];

      for (const suite of data.testResults || []) {
        for (const test of suite.assertionResults || []) {
          results.push({
            id: `jest_${results.length}`,
            name: test.title,
            file: suite.name,
            suite: test.ancestorTitles?.join(' > '),
            status: test.status as TestResult['status'],
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
    } catch {
      return [];
    }
  }

  /**
   * Vitest sonuçlarını parse et
   */
  private parseVitestResults(filePath: string): TestResult[] {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const results: TestResult[] = [];

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
    } catch {
      return [];
    }
  }

  /**
   * Coverage raporunu parse et
   */
  private parseCoverageReport(coverageDir: string): CoverageMap | null {
    try {
      const summaryPath = path.join(coverageDir, 'coverage-summary.json');
      if (!fs.existsSync(summaryPath)) return null;

      const data = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      const files: FileCoverage[] = [];

      for (const [filePath, coverage] of Object.entries(data)) {
        if (filePath === 'total') continue;
        
        const cov = coverage as any;
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
    } catch {
      return null;
    }
  }

  /**
   * Coverage verisini getir
   */
  collectCoverage(): CoverageMap | null {
    return this.coverage;
  }

  /**
   * Dosya için coverage getir
   */
  getCoverageForFile(file: string): FileCoverage | null {
    if (!this.coverage) return null;
    
    const relativePath = path.relative(this.projectPath, file);
    return this.coverage.files.find(f => 
      f.file.includes(relativePath) || relativePath.includes(f.file)
    ) || null;
  }

  /**
   * Runtime error logla
   */
  logError(error: Omit<RuntimeError, 'id' | 'frequency' | 'firstSeen' | 'lastSeen' | 'resolved'>): void {
    const existingIndex = this.errors.findIndex(e => 
      e.type === error.type && 
      e.message === error.message &&
      e.file === error.file
    );

    if (existingIndex >= 0) {
      this.errors[existingIndex].frequency++;
      this.errors[existingIndex].lastSeen = error.timestamp;
    } else {
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
  collectErrors(resolved: boolean = false): RuntimeError[] {
    return this.errors.filter(e => e.resolved === resolved);
  }

  /**
   * En sık karşılaşılan hatalar
   */
  getTopErrors(limit: number = 10): RuntimeError[] {
    return [...this.errors]
      .filter(e => !e.resolved)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  /**
   * Dosya için hatalar
   */
  getErrorsForFile(file: string): RuntimeError[] {
    const relativePath = path.relative(this.projectPath, file);
    return this.errors.filter(e => 
      e.file === file || e.file === relativePath
    );
  }

  /**
   * Hatayı resolved olarak işaretle
   */
  resolveError(id: string): void {
    const error = this.errors.find(e => e.id === id);
    if (error) {
      error.resolved = true;
      this.saveCache();
    }
  }

  /**
   * Performance trace logla
   */
  logTrace(trace: Omit<PerformanceTrace, 'id'>): void {
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
  collectTraces(): PerformanceTrace[] {
    return this.traces;
  }

  /**
   * Yavaş fonksiyonları bul
   */
  getSlowTraces(thresholdMs: number = 100): PerformanceTrace[] {
    return this.traces
      .filter(t => t.duration > thresholdMs)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Test summary
   */
  getTestSummary(): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage: CoverageSummary | null;
  } {
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
  getFailingTests(): TestResult[] {
    return this.testResults.filter(t => t.status === 'failed');
  }

  /**
   * Flaky testleri bul (retry yapılmış)
   */
  getFlakyTests(): TestResult[] {
    return this.testResults.filter(t => t.retries > 0);
  }
}

// Singleton
let runtimeCollector: RuntimeCollector | null = null;

export function getRuntimeCollector(projectPath: string): RuntimeCollector {
  if (!runtimeCollector || runtimeCollector['projectPath'] !== projectPath) {
    runtimeCollector = new RuntimeCollector(projectPath);
  }
  return runtimeCollector;
}

export default RuntimeCollector;
