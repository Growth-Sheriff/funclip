/**
 * FuncLib v4 - Copilot Action Collector
 * VS Code'dan Copilot aksiyonlarını yakalar ve loglar
 */

import * as fs from 'fs';
import * as path from 'path';

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
  cursorPosition: { line: number; column: number };
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
  range: { start: number; end: number };
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
  byLanguage: Record<string, { accepted: number; total: number }>;
  byHour: Record<number, { accepted: number; total: number }>;
}

export interface ParsedChange {
  type: 'add' | 'modify' | 'delete' | 'refactor';
  affectedSymbols: string[];
  linesChanged: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

export class CopilotCollector {
  private projectPath: string;
  private logPath: string;
  private actions: CopilotAction[] = [];
  private isWatching: boolean = false;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.logPath = path.join(projectPath, '.funclib', 'copilot-actions.json');
    this.load();
  }

  /**
   * Copilot aksiyonlarını yükle
   */
  private load(): void {
    try {
      if (fs.existsSync(this.logPath)) {
        const data = JSON.parse(fs.readFileSync(this.logPath, 'utf-8'));
        this.actions = data.actions.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        }));
      }
    } catch {
      this.actions = [];
    }
  }

  /**
   * Kaydet
   */
  private save(): void {
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
    } catch (e) {
      // Ignore write errors
    }
  }

  /**
   * Yeni aksiyon logla
   */
  logAction(action: Omit<CopilotAction, 'id' | 'timestamp'>): CopilotAction {
    const fullAction: CopilotAction = {
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
  logSuggestion(suggestion: CopilotSuggestion, file: string, line: number): void {
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
  logAccept(file: string, line: number, originalCode: string, acceptedCode: string): void {
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
  logReject(file: string, line: number, rejectedCode: string): void {
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
  getAcceptanceStats(days: number = 30): AcceptanceStats {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const recent = this.actions.filter(a => a.timestamp >= since);
    
    const accepted = recent.filter(a => a.type === 'accept').length;
    const rejected = recent.filter(a => a.type === 'reject').length;
    const modified = recent.filter(a => a.type === 'modify').length;
    const partialAccepted = recent.filter(a => a.type === 'partial_accept').length;
    const total = accepted + rejected + modified + partialAccepted;

    // Dil bazlı istatistikler
    const byLanguage: Record<string, { accepted: number; total: number }> = {};
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
    const byHour: Record<number, { accepted: number; total: number }> = {};
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
      .map(a => a.metadata.latency!);
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
  getRecentActions(limit: number = 100): CopilotAction[] {
    return this.actions.slice(-limit).reverse();
  }

  /**
   * Dosya için aksiyonları getir
   */
  getActionsForFile(file: string): CopilotAction[] {
    const relativePath = path.relative(this.projectPath, file);
    return this.actions.filter(a => 
      a.file === file || a.file === relativePath
    );
  }

  /**
   * Copilot değişikliklerini parse et
   */
  parseCopilotChanges(diff: string): ParsedChange[] {
    const changes: ParsedChange[] = [];
    const lines = diff.split('\n');
    
    let additions = 0;
    let deletions = 0;
    const affectedSymbols: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
        // Sembol tespiti
        const funcMatch = line.match(/(?:function|const|let|var|class|interface|type)\s+(\w+)/);
        if (funcMatch) {
          affectedSymbols.push(funcMatch[1]);
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    const linesChanged = additions + deletions;
    let type: ParsedChange['type'] = 'modify';
    
    if (deletions === 0 && additions > 0) {
      type = 'add';
    } else if (additions === 0 && deletions > 0) {
      type = 'delete';
    } else if (additions > deletions * 0.5 && deletions > additions * 0.5) {
      type = 'refactor';
    }

    const complexity: ParsedChange['complexity'] = 
      linesChanged > 50 ? 'complex' :
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
  extractPatterns(): Array<{ trigger: string; suggestion: string; count: number }> {
    const patterns: Map<string, { suggestion: string; count: number }> = new Map();
    
    const accepted = this.actions.filter(a => a.type === 'accept');
    
    for (const action of accepted) {
      // Context'ten trigger çıkar
      const trigger = this.extractTrigger(action);
      const key = `${trigger}::${action.suggestedCode.substring(0, 50)}`;
      
      if (patterns.has(key)) {
        patterns.get(key)!.count++;
      } else {
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

  private extractTrigger(action: CopilotAction): string {
    // Basit trigger extraction
    const lines = action.context.surroundingCode.split('\n');
    const lastLine = lines[lines.length - 1] || '';
    return lastLine.trim().substring(0, 30);
  }

  private detectLanguage(file: string): string {
    const ext = path.extname(file).toLowerCase();
    const langMap: Record<string, string> = {
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

  private generateId(): string {
    return `cop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton
let copilotCollector: CopilotCollector | null = null;

export function getCopilotCollector(projectPath: string): CopilotCollector {
  if (!copilotCollector || copilotCollector['projectPath'] !== projectPath) {
    copilotCollector = new CopilotCollector(projectPath);
  }
  return copilotCollector;
}

export default CopilotCollector;
