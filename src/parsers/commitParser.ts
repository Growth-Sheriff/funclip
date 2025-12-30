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

// Conventional commit types
const COMMIT_TYPES: Record<string, CommitIntent['type']> = {
  'feat': 'feature',
  'feature': 'feature',
  'fix': 'bugfix',
  'bugfix': 'bugfix',
  'hotfix': 'bugfix',
  'refactor': 'refactor',
  'refac': 'refactor',
  'docs': 'docs',
  'doc': 'docs',
  'documentation': 'docs',
  'test': 'test',
  'tests': 'test',
  'testing': 'test',
  'chore': 'chore',
  'perf': 'perf',
  'performance': 'perf',
  'style': 'style',
  'lint': 'style',
  'format': 'style',
  'ci': 'ci',
  'build': 'build',
  'deps': 'build',
  'revert': 'revert',
};

// Issue reference patterns
const ISSUE_PATTERNS = [
  { regex: /(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s*[:#]?\s*(\d+)/gi, type: 'fixes' as const },
  { regex: /(?:ref(?:erence)?s?|relates?\s*to)\s*[:#]?\s*(\d+)/gi, type: 'references' as const },
  { regex: /#(\d+)/g, type: 'references' as const },
];

// Breaking change indicators
const BREAKING_INDICATORS = [
  /BREAKING[\s-]?CHANGE/i,
  /\bbreaking\b/i,
  /!:/,
  /\bmajor\b.*\bchange\b/i,
];

export class CommitParser {
  /**
   * Conventional commit parse et
   */
  parseConventional(message: string): ConventionalCommit {
    const lines = message.trim().split('\n');
    const headerLine = lines[0] || '';
    
    // Pattern: type(scope)!: description
    const conventionalPattern = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
    const match = headerLine.match(conventionalPattern);

    if (match) {
      const [, type, scope, breaking, description] = match;
      const bodyLines = lines.slice(1).join('\n').trim();
      
      // Footer'ı body'den ayır (boş satırdan sonra gelen kısım)
      const bodyParts = bodyLines.split(/\n\n+/);
      const body = bodyParts[0] || undefined;
      const footer = bodyParts.slice(1).join('\n\n') || undefined;

      // Breaking change açıklaması
      let breakingDescription: string | undefined;
      if (footer) {
        const breakingMatch = footer.match(/BREAKING[\s-]?CHANGE[:\s]*(.+)/is);
        if (breakingMatch) {
          breakingDescription = breakingMatch[1].trim();
        }
      }

      return {
        type: type.toLowerCase(),
        scope: scope || undefined,
        description,
        body,
        footer,
        breaking: !!breaking || !!breakingDescription,
        breakingDescription,
        raw: message,
      };
    }

    // Conventional format değilse basit parse
    return {
      type: 'unknown',
      description: headerLine,
      body: lines.slice(1).join('\n').trim() || undefined,
      breaking: BREAKING_INDICATORS.some(p => p.test(message)),
      raw: message,
    };
  }

  /**
   * Commit intent'ini çıkar
   */
  extractIntent(message: string, changedFiles: string[] = []): CommitIntent {
    const conventional = this.parseConventional(message);
    
    // Type mapping
    const type = COMMIT_TYPES[conventional.type] || this.inferType(message);
    
    // Affected symbols çıkar
    const affectedSymbols = this.extractAffectedSymbols(message);
    
    // Confidence hesapla
    const confidence = this.calculateConfidence(conventional, changedFiles);
    
    // Priority hesapla
    const priority = this.calculatePriority(type, conventional.breaking);

    return {
      type,
      scope: conventional.scope || this.inferScope(message, changedFiles),
      summary: conventional.description,
      affectedSymbols,
      affectedFiles: changedFiles,
      confidence,
      isBreaking: conventional.breaking,
      priority,
    };
  }

  /**
   * Issue referanslarını çıkar
   */
  extractIssueRefs(message: string): IssueRef[] {
    const refs: IssueRef[] = [];
    const seen = new Set<string>();

    for (const { regex, type } of ISSUE_PATTERNS) {
      let match;
      while ((match = regex.exec(message)) !== null) {
        const issueNumber = parseInt(match[1]);
        const key = `${type}-${issueNumber}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          refs.push({ type, issueNumber });
        }
      }
    }

    return refs;
  }

  /**
   * Breaking change'leri tespit et
   */
  detectBreakingChanges(message: string, diff?: string): BreakingChange[] {
    const changes: BreakingChange[] = [];
    const conventional = this.parseConventional(message);

    if (conventional.breaking) {
      changes.push({
        description: conventional.breakingDescription || conventional.description,
        affectedAreas: this.extractAffectedAreas(message, diff),
      });
    }

    // Diff'ten breaking change tespiti
    if (diff) {
      const breakingPatterns = this.findBreakingPatterns(diff);
      for (const pattern of breakingPatterns) {
        changes.push({
          description: pattern.description,
          affectedAreas: pattern.areas,
        });
      }
    }

    return changes;
  }

  /**
   * Birden fazla commit'i analiz et
   */
  analyzeCommitHistory(messages: string[]): {
    types: Record<string, number>;
    topContributors: string[];
    breakingChanges: number;
    avgCommitSize: number;
  } {
    const types: Record<string, number> = {};
    let breakingChanges = 0;

    for (const message of messages) {
      const intent = this.extractIntent(message);
      types[intent.type] = (types[intent.type] || 0) + 1;
      
      if (intent.isBreaking) {
        breakingChanges++;
      }
    }

    return {
      types,
      topContributors: [], // Git collector'dan alınacak
      breakingChanges,
      avgCommitSize: 0, // Git collector'dan alınacak
    };
  }

  /**
   * Type infer et (conventional format değilse)
   */
  private inferType(message: string): CommitIntent['type'] {
    const lower = message.toLowerCase();

    if (/\b(add|new|feature|implement|create)\b/.test(lower)) return 'feature';
    if (/\b(fix|bug|issue|error|crash|problem)\b/.test(lower)) return 'bugfix';
    if (/\b(refactor|clean|simplify|restructure)\b/.test(lower)) return 'refactor';
    if (/\b(doc|readme|comment|jsdoc)\b/.test(lower)) return 'docs';
    if (/\b(test|spec|coverage)\b/.test(lower)) return 'test';
    if (/\b(perf|performance|optimize|speed|fast)\b/.test(lower)) return 'perf';
    if (/\b(style|format|lint|prettier|eslint)\b/.test(lower)) return 'style';
    if (/\b(ci|deploy|pipeline|workflow|github\s*action)\b/.test(lower)) return 'ci';
    if (/\b(build|webpack|vite|rollup|bundle|deps|dependency)\b/.test(lower)) return 'build';
    if (/\brevert\b/.test(lower)) return 'revert';

    return 'chore';
  }

  /**
   * Scope infer et
   */
  private inferScope(message: string, files: string[]): string {
    // Dosyalardan scope çıkar
    if (files.length > 0) {
      const dirs = files.map(f => {
        const parts = f.split('/');
        return parts.length > 1 ? parts[0] : '';
      }).filter(Boolean);
      
      // En çok tekrar eden directory
      const counts: Record<string, number> = {};
      for (const dir of dirs) {
        counts[dir] = (counts[dir] || 0) + 1;
      }
      
      const topDir = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (topDir) return topDir[0];
    }

    // Mesajdan scope çıkar
    const scopeMatch = message.match(/\b(api|ui|auth|editor|store|utils?|lib|core|config|types?|models?|services?|components?)\b/i);
    if (scopeMatch) return scopeMatch[1].toLowerCase();

    return '';
  }

  /**
   * Affected symbols çıkar
   */
  private extractAffectedSymbols(message: string): string[] {
    const symbols: string[] = [];
    
    // Backtick içindeki semboller
    const backtickMatches = message.matchAll(/`([a-zA-Z_$][a-zA-Z0-9_$]*)`/g);
    for (const match of backtickMatches) {
      symbols.push(match[1]);
    }

    // camelCase/PascalCase kelimeler (potansiyel semboller)
    const camelMatches = message.matchAll(/\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g);
    for (const match of camelMatches) {
      symbols.push(match[1]);
    }

    const pascalMatches = message.matchAll(/\b([A-Z][a-z]+[A-Z][a-zA-Z0-9]*)\b/g);
    for (const match of pascalMatches) {
      symbols.push(match[1]);
    }

    return [...new Set(symbols)];
  }

  /**
   * Confidence hesapla
   */
  private calculateConfidence(conventional: ConventionalCommit, files: string[]): number {
    let confidence = 0.5;

    // Conventional format kullanılmış
    if (conventional.type !== 'unknown') confidence += 0.2;
    
    // Scope var
    if (conventional.scope) confidence += 0.1;
    
    // Description yeterli uzunlukta
    if (conventional.description.length > 10) confidence += 0.1;
    
    // Body var
    if (conventional.body) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * Priority hesapla
   */
  private calculatePriority(type: CommitIntent['type'], breaking: boolean): CommitIntent['priority'] {
    if (breaking) return 'critical';
    
    switch (type) {
      case 'bugfix': return 'high';
      case 'feature': return 'medium';
      case 'perf': return 'medium';
      case 'refactor': return 'low';
      default: return 'low';
    }
  }

  /**
   * Affected areas çıkar
   */
  private extractAffectedAreas(message: string, diff?: string): string[] {
    const areas: string[] = [];
    
    // API değişiklikleri
    if (/\bapi\b/i.test(message) || (diff && /[-+]\s*export\s+(function|class|interface|type)/.test(diff))) {
      areas.push('API');
    }

    // Database değişiklikleri
    if (/\b(schema|migration|database|db)\b/i.test(message)) {
      areas.push('Database');
    }

    // Config değişiklikleri
    if (/\b(config|settings?|env)\b/i.test(message)) {
      areas.push('Configuration');
    }

    // UI değişiklikleri
    if (/\b(ui|component|style|css)\b/i.test(message)) {
      areas.push('UI');
    }

    return areas;
  }

  /**
   * Breaking patterns bul (diff'ten)
   */
  private findBreakingPatterns(diff: string): Array<{ description: string; areas: string[] }> {
    const patterns: Array<{ description: string; areas: string[] }> = [];

    // Function signature değişikliği
    if (/^-.*function\s+\w+\s*\([^)]*\)/m.test(diff) && /^\+.*function\s+\w+\s*\([^)]*\)/m.test(diff)) {
      patterns.push({
        description: 'Function signature changed',
        areas: ['API'],
      });
    }

    // Export kaldırılmış
    if (/^-\s*export\s+(default\s+)?(function|class|const|let|var)/m.test(diff)) {
      patterns.push({
        description: 'Export removed',
        areas: ['API'],
      });
    }

    // Interface/Type değişikliği
    if (/^-\s*(interface|type)\s+\w+/m.test(diff)) {
      patterns.push({
        description: 'Type definition changed',
        areas: ['Types'],
      });
    }

    return patterns;
  }
}

// Singleton instance
let commitParser: CommitParser | null = null;

export function getCommitParser(): CommitParser {
  if (!commitParser) {
    commitParser = new CommitParser();
  }
  return commitParser;
}

export default CommitParser;
