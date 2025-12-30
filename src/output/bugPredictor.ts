/**
 * FuncLib v4 - Bug Predictor
 * Potansiyel bug'ları tespit et, risk skorları hesapla
 */

import { Symbol } from '../types';
import { getKnowledgeGraph } from '../memory/knowledgeGraph';

export interface BugPrediction {
  symbol: string;
  file: string;
  line?: number;
  risk: 'critical' | 'high' | 'medium' | 'low';
  score: number;
  type: BugType;
  reason: string;
  suggestion: string;
  confidence: number;
  relatedBugs?: string[];
}

export type BugType =
  | 'null_reference'
  | 'type_mismatch'
  | 'race_condition'
  | 'memory_leak'
  | 'unhandled_error'
  | 'infinite_loop'
  | 'security_vulnerability'
  | 'performance_issue'
  | 'logic_error'
  | 'dead_code'
  | 'deprecated_usage'
  | 'breaking_change';

export interface HotspotInfo {
  file: string;
  changeFrequency: number;
  bugFrequency: number;
  complexity: number;
  lastChange: Date;
  authors: string[];
  riskScore: number;
}

export interface RiskAssessment {
  overall: number;
  factors: Array<{ name: string; weight: number; score: number }>;
  mitigations: string[];
}

interface CodePattern {
  pattern: RegExp;
  type: BugType;
  risk: BugPrediction['risk'];
  reason: string;
  suggestion: string;
}

export class BugPredictor {
  private projectPath: string;
  private riskyPatterns: CodePattern[] = [
    {
      pattern: /\.then\([^)]+\)(?!\s*\.catch)/,
      type: 'unhandled_error',
      risk: 'medium',
      reason: 'Promise without catch handler',
      suggestion: 'Add .catch() or use try/catch with await',
    },
    {
      pattern: /catch\s*\([^)]*\)\s*{\s*}/,
      type: 'unhandled_error',
      risk: 'high',
      reason: 'Empty catch block',
      suggestion: 'Log or handle the error appropriately',
    },
    {
      pattern: /setInterval\([^)]+\)/,
      type: 'memory_leak',
      risk: 'medium',
      reason: 'setInterval may cause memory leak',
      suggestion: 'Store ID and clear on cleanup',
    },
    {
      pattern: /eval\s*\(/,
      type: 'security_vulnerability',
      risk: 'critical',
      reason: 'eval() can cause code injection',
      suggestion: 'Avoid eval(), use safer alternatives',
    },
    {
      pattern: /innerHTML\s*=/,
      type: 'security_vulnerability',
      risk: 'high',
      reason: 'innerHTML may cause XSS',
      suggestion: 'Use textContent or sanitize HTML',
    },
    {
      pattern: /:\s*any\b/,
      type: 'type_mismatch',
      risk: 'low',
      reason: 'Using any type',
      suggestion: 'Use a specific type',
    },
    {
      pattern: /as\s+unknown\s+as/,
      type: 'type_mismatch',
      risk: 'medium',
      reason: 'Double type assertion',
      suggestion: 'Reconsider the type design',
    },
  ];

  constructor(projectPath?: string) {
    this.projectPath = projectPath || process.cwd();
  }

  predictBugs(symbol: Symbol, code?: string): BugPrediction[] {
    const predictions: BugPrediction[] = [];

    if (code) {
      for (const pattern of this.riskyPatterns) {
        if (pattern.pattern.test(code)) {
          predictions.push({
            symbol: symbol.name,
            file: symbol.file,
            line: symbol.range.start.line,
            risk: pattern.risk,
            score: this.riskToScore(pattern.risk),
            type: pattern.type,
            reason: pattern.reason,
            suggestion: pattern.suggestion,
            confidence: 0.8,
          });
        }
      }
    }

    // Dependency-based detection
    try {
      const graph = getKnowledgeGraph(this.projectPath);
      const outgoing = graph.getOutgoing(symbol.name, 'USES');
      
      if (outgoing.length > 15) {
        predictions.push({
          symbol: symbol.name,
          file: symbol.file,
          risk: 'medium',
          score: 0.5,
          type: 'logic_error',
          reason: `High coupling: ${outgoing.length} dependencies`,
          suggestion: 'Consider breaking down into smaller modules',
          confidence: 0.6,
        });
      }
    } catch {
      // Knowledge graph not available
    }

    return predictions.sort((a, b) => b.score - a.score);
  }

  private riskToScore(risk: BugPrediction['risk']): number {
    switch (risk) {
      case 'critical': return 0.95;
      case 'high': return 0.75;
      case 'medium': return 0.5;
      case 'low': return 0.25;
    }
  }

  calculateRiskScore(symbol: Symbol, code?: string): RiskAssessment {
    const factors: Array<{ name: string; weight: number; score: number }> = [];

    if (code) {
      let patternScore = 0;
      for (const pattern of this.riskyPatterns) {
        if (pattern.pattern.test(code)) {
          patternScore += this.riskToScore(pattern.risk);
        }
      }
      factors.push({
        name: 'Code Patterns',
        weight: 0.5,
        score: Math.min(1, patternScore / 3),
      });
    }

    try {
      const graph = getKnowledgeGraph(this.projectPath);
      const deps = graph.getOutgoing(symbol.name, 'USES');
      factors.push({
        name: 'Dependencies',
        weight: 0.5,
        score: Math.min(1, deps.length / 20),
      });
    } catch {
      factors.push({
        name: 'Dependencies',
        weight: 0.5,
        score: 0.3,
      });
    }

    const overall = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
    const mitigations: string[] = [];

    if (overall > 0.5) {
      mitigations.push('Consider code review for high-risk areas');
    }

    return { overall, factors, mitigations };
  }

  findHotspots(files: string[], limit: number = 10): HotspotInfo[] {
    const hotspots: HotspotInfo[] = files.map(file => ({
      file,
      changeFrequency: 0,
      bugFrequency: 0,
      complexity: 5,
      lastChange: new Date(),
      authors: [],
      riskScore: 0.3,
    }));

    return hotspots
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);
  }

  addPattern(pattern: CodePattern): void {
    this.riskyPatterns.push(pattern);
  }

  listPatterns(): Array<{ type: BugType; risk: string; reason: string }> {
    return this.riskyPatterns.map(p => ({
      type: p.type,
      risk: p.risk,
      reason: p.reason,
    }));
  }
}

let instance: BugPredictor | null = null;

export function getBugPredictor(projectPath?: string): BugPredictor {
  if (!instance) {
    instance = new BugPredictor(projectPath);
  }
  return instance;
}

export default BugPredictor;
