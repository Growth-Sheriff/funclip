/**
 * FuncLib v4 - Copilot Guide
 * GitHub Copilot için bağlam hazırla ve önerileri değerlendir
 */

import { Symbol } from '../types';
import { getKnowledgeGraph } from '../memory/knowledgeGraph';
import { getCrossProjectKB } from '../memory/crossProjectKB';

export interface CopilotContext {
  currentSymbol?: SymbolContext;
  relatedSymbols: SymbolContext[];
  patterns: PatternContext[];
  warnings: Warning[];
  recentChanges: ChangeContext[];
  metadata: {
    projectName: string;
    language: string;
    framework?: string;
  };
}

export interface SymbolContext {
  name: string;
  kind: string;
  signature?: string;
  docstring?: string;
  file: string;
  dependencies: string[];
  dependents: string[];
}

export interface ChangeContext {
  symbol: string;
  type: 'added' | 'modified' | 'deleted';
  date: Date;
  author?: string;
}

export interface PatternContext {
  name: string;
  description: string;
  example?: string;
  frequency: number;
}

export interface Warning {
  type: 'breaking' | 'deprecated' | 'security' | 'performance' | 'style';
  message: string;
  severity: 'info' | 'warning' | 'error';
  symbol?: string;
}

export interface SuggestionEvaluation {
  accepted: boolean;
  score: number;
  reasons: string[];
  alternatives: string[];
  warnings: Warning[];
}

export class CopilotGuide {
  private projectPath: string;

  constructor(projectPath?: string) {
    this.projectPath = projectPath || process.cwd();
  }

  prepareContext(symbolName?: string): CopilotContext {
    const relatedSymbols: SymbolContext[] = [];
    const warnings: Warning[] = [];
    const patterns: PatternContext[] = [];
    let currentSymbol: SymbolContext | undefined;

    // Get related symbols
    if (symbolName) {
      try {
        const graph = getKnowledgeGraph(this.projectPath);
        const node = graph.getNode(symbolName);
        
        if (node) {
          const outgoing = graph.getOutgoing(symbolName, 'USES');
          const incoming = graph.getIncoming(symbolName, 'USES');
          
          currentSymbol = {
            name: node.name,
            kind: node.type || 'symbol',
            file: node.file || '',
            dependencies: outgoing.map(o => o.target.name),
            dependents: incoming.map(i => i.source.name),
          };

          // Add dependencies as related symbols
          for (const dep of outgoing.slice(0, 10)) {
            relatedSymbols.push({
              name: dep.target.name,
              kind: dep.target.type || 'symbol',
              file: dep.target.file || '',
              dependencies: [],
              dependents: [],
            });
          }
        }
      } catch {
        // Knowledge graph not available
      }
    }

    // Get patterns from cross-project KB
    try {
      const kb = getCrossProjectKB();
      const usedPatterns = kb.getMostUsedPatterns();
      
      for (const p of usedPatterns.slice(0, 5)) {
        patterns.push({
          name: p.name,
          description: p.description,
          example: p.code,
          frequency: p.frequency,
        });
      }
    } catch {
      // Cross-project KB not available
    }

    return {
      currentSymbol,
      relatedSymbols,
      patterns,
      warnings,
      recentChanges: [],
      metadata: {
        projectName: this.getProjectName(),
        language: 'typescript',
      },
    };
  }

  evaluateSuggestion(suggestion: string, context: CopilotContext): SuggestionEvaluation {
    const reasons: string[] = [];
    const alternatives: string[] = [];
    const warnings: Warning[] = [];
    let score = 0.5;

    // Pattern matching
    for (const pattern of context.patterns) {
      if (suggestion.includes(pattern.name) || suggestion.toLowerCase().includes(pattern.description.toLowerCase())) {
        score += 0.1;
        reasons.push(`Matches pattern: ${pattern.name}`);
      }
    }

    // Security checks
    if (suggestion.includes('eval(')) {
      score -= 0.3;
      warnings.push({
        type: 'security',
        message: 'Avoid using eval()',
        severity: 'error',
      });
    }

    if (suggestion.includes('innerHTML')) {
      score -= 0.1;
      warnings.push({
        type: 'security',
        message: 'innerHTML may cause XSS',
        severity: 'warning',
      });
    }

    // Type safety
    if (suggestion.includes(': any')) {
      score -= 0.05;
      warnings.push({
        type: 'style',
        message: 'Consider using a specific type instead of any',
        severity: 'info',
      });
    }

    // Score normalization
    score = Math.max(0, Math.min(1, score));

    return {
      accepted: score >= 0.5,
      score,
      reasons,
      alternatives,
      warnings,
    };
  }

  suggestAlternatives(suggestion: string, context: CopilotContext): string[] {
    const alternatives: string[] = [];

    // Replace any with unknown
    if (suggestion.includes(': any')) {
      alternatives.push(suggestion.replace(/:\s*any\b/g, ': unknown'));
    }

    // Replace innerHTML with textContent
    if (suggestion.includes('innerHTML')) {
      alternatives.push(suggestion.replace(/innerHTML/g, 'textContent'));
    }

    // Add null checks
    const nullRiskPattern = /(\w+)\.(\w+)/g;
    const matches = suggestion.match(nullRiskPattern);
    if (matches && matches.length > 0) {
      const safeVersion = suggestion.replace(nullRiskPattern, '$1?.$2');
      if (safeVersion !== suggestion) {
        alternatives.push(safeVersion);
      }
    }

    return alternatives;
  }

  warnIfRisky(code: string): Warning[] {
    const warnings: Warning[] = [];

    // Security warnings
    if (/eval\s*\(/.test(code)) {
      warnings.push({
        type: 'security',
        message: 'eval() can lead to code injection',
        severity: 'error',
      });
    }

    if (/new\s+Function\s*\(/.test(code)) {
      warnings.push({
        type: 'security',
        message: 'new Function() is similar to eval()',
        severity: 'error',
      });
    }

    if (/dangerouslySetInnerHTML/.test(code)) {
      warnings.push({
        type: 'security',
        message: 'dangerouslySetInnerHTML may cause XSS',
        severity: 'warning',
      });
    }

    // Performance warnings
    if (/\.forEach\([^)]*await/.test(code)) {
      warnings.push({
        type: 'performance',
        message: 'await inside forEach may cause sequential execution',
        severity: 'warning',
      });
    }

    if (/for\s*\([^)]*\.length/.test(code)) {
      warnings.push({
        type: 'performance',
        message: 'Accessing .length in loop condition is inefficient',
        severity: 'info',
      });
    }

    // Deprecated patterns
    if (/var\s+/.test(code)) {
      warnings.push({
        type: 'deprecated',
        message: 'Prefer let/const over var',
        severity: 'info',
      });
    }

    return warnings;
  }

  private getProjectName(): string {
    const parts = this.projectPath.split(/[/\\]/);
    return parts[parts.length - 1] || 'unknown';
  }

  generateGuidance(symbolName: string): string {
    const context = this.prepareContext(symbolName);
    const lines: string[] = [];

    lines.push(`# Copilot Guidance for ${symbolName}`);
    lines.push('');

    if (context.currentSymbol) {
      lines.push(`## Current Symbol`);
      lines.push(`- Kind: ${context.currentSymbol.kind}`);
      lines.push(`- File: ${context.currentSymbol.file}`);
      lines.push(`- Dependencies: ${context.currentSymbol.dependencies.length}`);
      lines.push(`- Dependents: ${context.currentSymbol.dependents.length}`);
      lines.push('');
    }

    if (context.relatedSymbols.length > 0) {
      lines.push(`## Related Symbols`);
      for (const sym of context.relatedSymbols.slice(0, 5)) {
        lines.push(`- ${sym.name} (${sym.kind})`);
      }
      lines.push('');
    }

    if (context.patterns.length > 0) {
      lines.push(`## Recommended Patterns`);
      for (const p of context.patterns) {
        lines.push(`- ${p.name}: ${p.description}`);
      }
      lines.push('');
    }

    if (context.warnings.length > 0) {
      lines.push(`## Warnings`);
      for (const w of context.warnings) {
        lines.push(`- [${w.severity}] ${w.message}`);
      }
    }

    return lines.join('\n');
  }
}

let instance: CopilotGuide | null = null;

export function getCopilotGuide(projectPath?: string): CopilotGuide {
  if (!instance) {
    instance = new CopilotGuide(projectPath);
  }
  return instance;
}

export default CopilotGuide;
