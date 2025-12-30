"use strict";
/**
 * FuncLib v4 - Temporal Memory
 * Sembol ve dosya değişiklik geçmişini takip eder
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
exports.TemporalMemory = void 0;
exports.getTemporalMemory = getTemporalMemory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gitCollector_1 = require("../collectors/gitCollector");
class TemporalMemory {
    projectPath;
    gitCollector;
    dataPath;
    symbolHistory = new Map();
    fileHistory = new Map();
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.gitCollector = (0, gitCollector_1.getGitCollector)(projectPath);
        this.dataPath = path.join(projectPath, '.funclib', 'temporal.json');
        this.load();
    }
    /**
     * Sembol geçmişini takip et
     */
    trackSymbol(symbolName) {
        // Cache'te varsa dön
        if (this.symbolHistory.has(symbolName)) {
            return this.symbolHistory.get(symbolName);
        }
        // Git history'den ara
        const commits = this.gitCollector.getCommitHistory(90);
        const events = [];
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
        const timeline = {
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
    trackFile(file) {
        // Cache'te varsa dön
        if (this.fileHistory.has(file)) {
            return this.fileHistory.get(file);
        }
        const commits = this.gitCollector.getCommitHistory(90);
        const events = [];
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
        const timeline = {
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
    analyzeTrends() {
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
    detectAnomalies() {
        const anomalies = [];
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
    getVolatileSymbols(limit = 10) {
        const results = [];
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
    getStableSymbols(limit = 10) {
        const results = [];
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
    save() {
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
    load() {
        try {
            if (!fs.existsSync(this.dataPath))
                return false;
            const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
            // Date'leri restore et
            this.symbolHistory = new Map(Object.entries(data.symbols || {}).map(([k, v]) => [
                k,
                {
                    ...v,
                    events: v.events.map((e) => ({ ...e, timestamp: new Date(e.timestamp) })),
                    metrics: {
                        ...v.metrics,
                        lastModified: v.metrics.lastModified ? new Date(v.metrics.lastModified) : null,
                        firstSeen: v.metrics.firstSeen ? new Date(v.metrics.firstSeen) : null,
                    },
                },
            ]));
            this.fileHistory = new Map(Object.entries(data.files || {}).map(([k, v]) => [
                k,
                {
                    ...v,
                    events: v.events.map((e) => ({ ...e, timestamp: new Date(e.timestamp) })),
                    metrics: {
                        ...v.metrics,
                        lastModified: v.metrics.lastModified ? new Date(v.metrics.lastModified) : null,
                    },
                },
            ]));
            return true;
        }
        catch {
            return false;
        }
    }
    clear() {
        this.symbolHistory.clear();
        this.fileHistory.clear();
        if (fs.existsSync(this.dataPath)) {
            fs.unlinkSync(this.dataPath);
        }
    }
    // ========================
    // Private helpers
    // ========================
    calculateSymbolMetrics(events) {
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
    calculateFileMetrics(events) {
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
    calculateWeeklyBugFixes(commits) {
        const weeklyBugs = new Map();
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
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }
}
exports.TemporalMemory = TemporalMemory;
// Singleton
let temporalMemory = null;
function getTemporalMemory(projectPath) {
    if (!temporalMemory || temporalMemory['projectPath'] !== projectPath) {
        temporalMemory = new TemporalMemory(projectPath);
    }
    return temporalMemory;
}
exports.default = TemporalMemory;
//# sourceMappingURL=temporalMemory.js.map