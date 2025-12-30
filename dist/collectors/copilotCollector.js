"use strict";
/**
 * FuncLib v4 - Copilot Action Collector
 * VS Code'dan Copilot aksiyonlarını yakalar ve loglar
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
exports.CopilotCollector = void 0;
exports.getCopilotCollector = getCopilotCollector;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CopilotCollector {
    projectPath;
    logPath;
    actions = [];
    isWatching = false;
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.logPath = path.join(projectPath, '.funclib', 'copilot-actions.json');
        this.load();
    }
    /**
     * Copilot aksiyonlarını yükle
     */
    load() {
        try {
            if (fs.existsSync(this.logPath)) {
                const data = JSON.parse(fs.readFileSync(this.logPath, 'utf-8'));
                this.actions = data.actions.map((a) => ({
                    ...a,
                    timestamp: new Date(a.timestamp),
                }));
            }
        }
        catch {
            this.actions = [];
        }
    }
    /**
     * Kaydet
     */
    save() {
        try {
            const dir = path.dirname(this.logPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.logPath, JSON.stringify({
                version: 1,
                lastUpdated: new Date().toISOString(),
                actions: this.actions,
            }, null, 2));
        }
        catch (e) {
            // Ignore write errors
        }
    }
    /**
     * Yeni aksiyon logla
     */
    logAction(action) {
        const fullAction = {
            ...action,
            id: this.generateId(),
            timestamp: new Date(),
        };
        this.actions.push(fullAction);
        // Sadece son 10000 aksiyonu tut
        if (this.actions.length > 10000) {
            this.actions = this.actions.slice(-10000);
        }
        this.save();
        return fullAction;
    }
    /**
     * Suggestion logla
     */
    logSuggestion(suggestion, file, line) {
        this.logAction({
            type: 'suggest',
            file,
            line,
            column: 0,
            originalCode: '',
            suggestedCode: suggestion.text,
            language: this.detectLanguage(file),
            context: {
                surroundingCode: '',
                openFiles: [],
                recentCommands: [],
                cursorPosition: { line, column: 0 },
                triggerKind: 'automatic',
            },
            metadata: {
                completionId: suggestion.id,
            },
        });
    }
    /**
     * Accept logla
     */
    logAccept(file, line, originalCode, acceptedCode) {
        this.logAction({
            type: 'accept',
            file,
            line,
            column: 0,
            originalCode,
            suggestedCode: acceptedCode,
            finalCode: acceptedCode,
            language: this.detectLanguage(file),
            context: {
                surroundingCode: '',
                openFiles: [],
                recentCommands: [],
                cursorPosition: { line, column: 0 },
                triggerKind: 'automatic',
            },
            metadata: {},
        });
    }
    /**
     * Reject logla
     */
    logReject(file, line, rejectedCode) {
        this.logAction({
            type: 'reject',
            file,
            line,
            column: 0,
            originalCode: '',
            suggestedCode: rejectedCode,
            language: this.detectLanguage(file),
            context: {
                surroundingCode: '',
                openFiles: [],
                recentCommands: [],
                cursorPosition: { line, column: 0 },
                triggerKind: 'automatic',
            },
            metadata: {},
        });
    }
    /**
     * Kabul/red istatistikleri
     */
    getAcceptanceStats(days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const recent = this.actions.filter(a => a.timestamp >= since);
        const accepted = recent.filter(a => a.type === 'accept').length;
        const rejected = recent.filter(a => a.type === 'reject').length;
        const modified = recent.filter(a => a.type === 'modify').length;
        const partialAccepted = recent.filter(a => a.type === 'partial_accept').length;
        const total = accepted + rejected + modified + partialAccepted;
        // Dil bazlı istatistikler
        const byLanguage = {};
        for (const action of recent) {
            if (!byLanguage[action.language]) {
                byLanguage[action.language] = { accepted: 0, total: 0 };
            }
            byLanguage[action.language].total++;
            if (action.type === 'accept' || action.type === 'partial_accept') {
                byLanguage[action.language].accepted++;
            }
        }
        // Saat bazlı istatistikler
        const byHour = {};
        for (let h = 0; h < 24; h++) {
            byHour[h] = { accepted: 0, total: 0 };
        }
        for (const action of recent) {
            const hour = action.timestamp.getHours();
            byHour[hour].total++;
            if (action.type === 'accept' || action.type === 'partial_accept') {
                byHour[hour].accepted++;
            }
        }
        // Ortalama latency
        const latencies = recent
            .filter(a => a.metadata.latency)
            .map(a => a.metadata.latency);
        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
        return {
            total,
            accepted,
            rejected,
            modified,
            partialAccepted,
            acceptanceRate: total > 0 ? (accepted + partialAccepted) / total : 0,
            avgLatency,
            byLanguage,
            byHour,
        };
    }
    /**
     * Son aksiyonları getir
     */
    getRecentActions(limit = 100) {
        return this.actions.slice(-limit).reverse();
    }
    /**
     * Dosya için aksiyonları getir
     */
    getActionsForFile(file) {
        const relativePath = path.relative(this.projectPath, file);
        return this.actions.filter(a => a.file === file || a.file === relativePath);
    }
    /**
     * Copilot değişikliklerini parse et
     */
    parseCopilotChanges(diff) {
        const changes = [];
        const lines = diff.split('\n');
        let additions = 0;
        let deletions = 0;
        const affectedSymbols = [];
        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
                // Sembol tespiti
                const funcMatch = line.match(/(?:function|const|let|var|class|interface|type)\s+(\w+)/);
                if (funcMatch) {
                    affectedSymbols.push(funcMatch[1]);
                }
            }
            else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
            }
        }
        const linesChanged = additions + deletions;
        let type = 'modify';
        if (deletions === 0 && additions > 0) {
            type = 'add';
        }
        else if (additions === 0 && deletions > 0) {
            type = 'delete';
        }
        else if (additions > deletions * 0.5 && deletions > additions * 0.5) {
            type = 'refactor';
        }
        const complexity = linesChanged > 50 ? 'complex' :
            linesChanged > 10 ? 'moderate' : 'simple';
        changes.push({
            type,
            affectedSymbols: [...new Set(affectedSymbols)],
            linesChanged,
            complexity,
        });
        return changes;
    }
    /**
     * Pattern çıkar
     */
    extractPatterns() {
        const patterns = new Map();
        const accepted = this.actions.filter(a => a.type === 'accept');
        for (const action of accepted) {
            // Context'ten trigger çıkar
            const trigger = this.extractTrigger(action);
            const key = `${trigger}::${action.suggestedCode.substring(0, 50)}`;
            if (patterns.has(key)) {
                patterns.get(key).count++;
            }
            else {
                patterns.set(key, {
                    suggestion: action.suggestedCode,
                    count: 1,
                });
            }
        }
        return Array.from(patterns.entries())
            .map(([key, value]) => ({
            trigger: key.split('::')[0],
            suggestion: value.suggestion,
            count: value.count,
        }))
            .filter(p => p.count > 2)
            .sort((a, b) => b.count - a.count);
    }
    extractTrigger(action) {
        // Basit trigger extraction
        const lines = action.context.surroundingCode.split('\n');
        const lastLine = lines[lines.length - 1] || '';
        return lastLine.trim().substring(0, 30);
    }
    detectLanguage(file) {
        const ext = path.extname(file).toLowerCase();
        const langMap = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.vue': 'vue',
            '.py': 'python',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.kt': 'kotlin',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.dart': 'dart',
        };
        return langMap[ext] || 'unknown';
    }
    generateId() {
        return `cop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.CopilotCollector = CopilotCollector;
// Singleton
let copilotCollector = null;
function getCopilotCollector(projectPath) {
    if (!copilotCollector || copilotCollector['projectPath'] !== projectPath) {
        copilotCollector = new CopilotCollector(projectPath);
    }
    return copilotCollector;
}
exports.default = CopilotCollector;
//# sourceMappingURL=copilotCollector.js.map