/**
 * FuncLib v4 - Temporal Memory
 * Sembol ve dosya değişiklik geçmişini takip eder
 */

import * as fs from 'fs';
import * as path from 'path';
import { GitCollector, getGitCollector, Commit } from '../collectors/gitCollector';

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
  avgChangeFrequency: number;  // Günde ortalama değişiklik
  stabilityScore: number;      // 0-1, yüksek = stabil
  hotspotScore: number;        // 0-1, yüksek = sık değişen
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
  churnRate: number;          // Toplam eklenen + silinen satır
  stabilityScore: number;
  hotspotScore: number;
  lastModified: Date;
  authors: string[];
}

export interface TrendReport {
  period: { start: Date; end: Date };
  mostChanged: Array<{ file: string; changes: number }>;
  mostActive: Array<{ author: string; commits: number }>;
  bugFixTrend: Array<{ week: string; count: number }>;
  complexityTrend: Array<{ week: string; avgComplexity: number }>;
}

export interface Anomaly {
  type: 'sudden_change' | 'unusual_author' | 'large_commit' | 'late_night_commit';
  file?: string;
  commit: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export class TemporalMemory {
  private projectPath: string;
  private gitCollector: GitCollector;
  private dataPath: string;
  private symbolHistory: Map<string, SymbolTimeline> = new Map();
  private fileHistory: Map<string, FileTimeline> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.gitCollector = getGitCollector(projectPath);
    this.dataPath = path.join(projectPath, '.funclib', 'temporal.json');
    this.load();
  }

  /**
   * Sembol geçmişini takip et
   */
  trackSymbol(symbolName: string): SymbolTimeline {
    // Cache'te varsa dön
    if (this.symbolHistory.has(symbolName)) {
      return this.symbolHistory.get(symbolName)!;
    }

    // Git history'den ara
    const commits = this.gitCollector.getCommitHistory(90);
    const events: SymbolEvent[] = [];

    for (const commit of commits) {
      // Commit mesajında sembol adı geçiyor mu?
      if (commit.message.toLowerCase().includes(symbolName.toLowerCase())) {
        events.push({
          timestamp: commit.date,
          type: 'modified',
          author: commit.author,
          commit: commit.shortHash,
          message: commit.message,
          file: commit.files[0] || '',
        });
      }
    }

    // Event'ler yoksa boş timeline
    const timeline: SymbolTimeline = {
      symbol: symbolName,
      events: events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      metrics: this.calculateSymbolMetrics(events),
    };

    this.symbolHistory.set(symbolName, timeline);
    return timeline;
  }

  /**
   * Dosya geçmişini takip et
   */
  trackFile(file: string): FileTimeline {
    // Cache'te varsa dön
    if (this.fileHistory.has(file)) {
      return this.fileHistory.get(file)!;
    }

    const commits = this.gitCollector.getCommitHistory(90);
    const events: FileEvent[] = [];

    for (const commit of commits) {
      if (commit.files.includes(file)) {
        events.push({
          timestamp: commit.date,
          type: 'modified',
          author: commit.author,
          commit: commit.shortHash,
          message: commit.message,
          insertions: commit.insertions,
          deletions: commit.deletions,
        });
      }
    }

    const timeline: FileTimeline = {
      file,
      events: events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      metrics: this.calculateFileMetrics(events),
    };

    this.fileHistory.set(file, timeline);
    return timeline;
  }

  /**
   * Trend analizi
   */
  analyzeTrends(): TrendReport {
    const commits = this.gitCollector.getCommitHistory(90);
    const hotspots = this.gitCollector.getHotspots(10);
    const authors = this.gitCollector.getAuthorStats();

    // Bug fix trendi (haftalık)
    const bugFixTrend = this.calculateWeeklyBugFixes(commits);

    return {
      period: {
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      mostChanged: hotspots.map(h => ({ file: h.file, changes: h.changeCount })),
      mostActive: authors
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 10)
        .map(a => ({ author: a.author, commits: a.commits })),
      bugFixTrend,
      complexityTrend: [], // Ayrı hesaplanacak
    };
  }

  /**
   * Anomali tespiti
   */
  detectAnomalies(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const commits = this.gitCollector.getCommitHistory(30);

    for (const commit of commits) {
      // Büyük commit (100+ satır değişiklik)
      if (commit.insertions + commit.deletions > 500) {
        anomalies.push({
          type: 'large_commit',
          commit: commit.shortHash,
          description: `Çok büyük commit: ${commit.insertions + commit.deletions} satır değişiklik`,
          severity: 'medium',
          timestamp: commit.date,
        });
      }

      // Gece yarısı commit'i
      const hour = commit.date.getHours();
      if (hour >= 0 && hour < 6) {
        anomalies.push({
          type: 'late_night_commit',
          commit: commit.shortHash,
          description: `Gece yarısı commit: ${commit.date.toLocaleTimeString()}`,
          severity: 'low',
          timestamp: commit.date,
        });
      }
    }

    // Ani değişiklik anomalisi
    const hotspots = this.gitCollector.getHotspots(50);
    for (const hotspot of hotspots) {
      if (hotspot.changeCount > 20) {
        anomalies.push({
          type: 'sudden_change',
          file: hotspot.file,
          commit: '',
          description: `Sık değişen dosya: ${hotspot.changeCount} değişiklik (90 gün)`,
          severity: hotspot.changeCount > 30 ? 'high' : 'medium',
          timestamp: hotspot.lastModified,
        });
      }
    }

    return anomalies.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * En sık değişen semboller
   */
  getVolatileSymbols(limit: number = 10): Array<{ symbol: string; changes: number; score: number }> {
    const results: Array<{ symbol: string; changes: number; score: number }> = [];

    for (const [symbol, timeline] of this.symbolHistory) {
      results.push({
        symbol,
        changes: timeline.metrics.totalChanges,
        score: timeline.metrics.hotspotScore,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * En stabil semboller
   */
  getStableSymbols(limit: number = 10): Array<{ symbol: string; daysSinceChange: number; score: number }> {
    const results: Array<{ symbol: string; daysSinceChange: number; score: number }> = [];
    const now = Date.now();

    for (const [symbol, timeline] of this.symbolHistory) {
      const daysSinceChange = timeline.metrics.lastModified 
        ? Math.floor((now - timeline.metrics.lastModified.getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      results.push({
        symbol,
        daysSinceChange,
        score: timeline.metrics.stabilityScore,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ========================
  // Persistence
  // ========================

  save(): void {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      symbols: Object.fromEntries(this.symbolHistory),
      files: Object.fromEntries(this.fileHistory),
    };

    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
  }

  load(): boolean {
    try {
      if (!fs.existsSync(this.dataPath)) return false;

      const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
      
      // Date'leri restore et
      this.symbolHistory = new Map(
        Object.entries(data.symbols || {}).map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            events: v.events.map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) })),
            metrics: {
              ...v.metrics,
              lastModified: v.metrics.lastModified ? new Date(v.metrics.lastModified) : null,
              firstSeen: v.metrics.firstSeen ? new Date(v.metrics.firstSeen) : null,
            },
          },
        ])
      );

      this.fileHistory = new Map(
        Object.entries(data.files || {}).map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            events: v.events.map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) })),
            metrics: {
              ...v.metrics,
              lastModified: v.metrics.lastModified ? new Date(v.metrics.lastModified) : null,
            },
          },
        ])
      );

      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    this.symbolHistory.clear();
    this.fileHistory.clear();
    if (fs.existsSync(this.dataPath)) {
      fs.unlinkSync(this.dataPath);
    }
  }

  // ========================
  // Private helpers
  // ========================

  private calculateSymbolMetrics(events: SymbolEvent[]): SymbolTimelineMetrics {
    if (events.length === 0) {
      return {
        totalChanges: 0,
        avgChangeFrequency: 0,
        stabilityScore: 1,
        hotspotScore: 0,
        lastModified: new Date(),
        firstSeen: new Date(),
        authors: [],
      };
    }

    const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const firstSeen = sorted[0].timestamp;
    const lastModified = sorted[sorted.length - 1].timestamp;
    const daySpan = Math.max(1, (lastModified.getTime() - firstSeen.getTime()) / (24 * 60 * 60 * 1000));

    const authors = [...new Set(events.map(e => e.author))];

    return {
      totalChanges: events.length,
      avgChangeFrequency: events.length / daySpan,
      stabilityScore: Math.max(0, 1 - (events.length / 30)),
      hotspotScore: Math.min(1, events.length / 20),
      lastModified,
      firstSeen,
      authors,
    };
  }

  private calculateFileMetrics(events: FileEvent[]): FileTimelineMetrics {
    if (events.length === 0) {
      return {
        totalChanges: 0,
        avgChangeSize: 0,
        churnRate: 0,
        stabilityScore: 1,
        hotspotScore: 0,
        lastModified: new Date(),
        authors: [],
      };
    }

    const totalChurn = events.reduce((sum, e) => sum + e.insertions + e.deletions, 0);
    const authors = [...new Set(events.map(e => e.author))];
    
    const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const lastModified = sorted[sorted.length - 1].timestamp;

    return {
      totalChanges: events.length,
      avgChangeSize: totalChurn / events.length,
      churnRate: totalChurn,
      stabilityScore: Math.max(0, 1 - (events.length / 30)),
      hotspotScore: Math.min(1, events.length / 20),
      lastModified,
      authors,
    };
  }

  private calculateWeeklyBugFixes(commits: Commit[]): Array<{ week: string; count: number }> {
    const weeklyBugs: Map<string, number> = new Map();

    for (const commit of commits) {
      const msg = commit.message.toLowerCase();
      if (msg.includes('fix') || msg.includes('bug') || msg.includes('hata')) {
        const weekStart = this.getWeekStart(commit.date);
        const key = weekStart.toISOString().split('T')[0];
        weeklyBugs.set(key, (weeklyBugs.get(key) || 0) + 1);
      }
    }

    return Array.from(weeklyBugs.entries())
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

// Singleton
let temporalMemory: TemporalMemory | null = null;

export function getTemporalMemory(projectPath: string): TemporalMemory {
  if (!temporalMemory || temporalMemory['projectPath'] !== projectPath) {
    temporalMemory = new TemporalMemory(projectPath);
  }
  return temporalMemory;
}

export default TemporalMemory;
