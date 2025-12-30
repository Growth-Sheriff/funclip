/**
 * FuncLib v4 - Impact Analyzer
 * Değişikliklerin etkisini analiz et
 */

import { Symbol } from '../types';
import { getKnowledgeGraph } from '../memory/knowledgeGraph';

export interface ImpactAnalysis {
  changedSymbol: string;
  directImpact: DirectImpact[];
  transitiveImpact: TransitiveImpact[];
  testImpact: TestImpact[];
  summary: {
    totalAffected: number;
    criticalFiles: number;
    testsAffected: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface DirectImpact {
  symbol: string;
  file: string;
  relation: string;
  reason: string;
}

export interface TransitiveImpact {
  symbol: string;
  file: string;
  path: string[];
  distance: number;
}

export interface TestImpact {
  testFile: string;
  testName: string;
  reason: string;
  confidence: number;
}

export interface WhatIfScenario {
  change: string;
  possibleImpact: ImpactAnalysis;
  recommendations: string[];
  riskScore: number;
}

export class ImpactAnalyzer {
  private projectPath: string;

  constructor(projectPath?: string) {
    this.projectPath = projectPath || process.cwd();
  }

  analyze(symbol: Symbol | string): ImpactAnalysis {
    const symbolName = typeof symbol === 'string' ? symbol : symbol.name;
    const directImpact: DirectImpact[] = [];
    const transitiveImpact: TransitiveImpact[] = [];
    const testImpact: TestImpact[] = [];

    try {
      const graph = getKnowledgeGraph(this.projectPath);
      
      // Direct dependents (who uses this symbol)
      const incoming = graph.getIncoming(symbolName, 'USES');
      
      for (const dep of incoming) {
        directImpact.push({
          symbol: dep.source.name,
          file: dep.source.file || '',
          relation: 'USES',
          reason: `Uses ${symbolName}`,
        });

        // Transitive (1-level deep for now)
        const transitiveDeps = graph.getIncoming(dep.source.name, 'USES');
        for (const transDep of transitiveDeps) {
          transitiveImpact.push({
            symbol: transDep.source.name,
            file: transDep.source.file || '',
            path: [symbolName, dep.source.name, transDep.source.name],
            distance: 2,
          });
        }
      }

      // Inheritance/implementation - use 'EXTENDS' which is a valid EdgeType
      const inheritors = graph.getIncoming(symbolName, 'EXTENDS');
      for (const inh of inheritors) {
        directImpact.push({
          symbol: inh.source.name,
          file: inh.source.file || '',
          relation: 'EXTENDS',
          reason: `Extends ${symbolName}`,
        });
      }
    } catch {
      // Knowledge graph not available
    }

    // Test impact
    for (const d of directImpact) {
      if (d.file.includes('.test.') || d.file.includes('.spec.')) {
        testImpact.push({
          testFile: d.file,
          testName: d.symbol,
          reason: `Tests ${symbolName}`,
          confidence: 0.9,
        });
      }
    }

    const totalAffected = directImpact.length + transitiveImpact.length;
    const criticalFiles = new Set(directImpact.map(d => d.file)).size;
    const testsAffected = testImpact.length;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (totalAffected > 50) riskLevel = 'critical';
    else if (totalAffected > 20) riskLevel = 'high';
    else if (totalAffected > 5) riskLevel = 'medium';

    return {
      changedSymbol: symbolName,
      directImpact,
      transitiveImpact,
      testImpact,
      summary: {
        totalAffected,
        criticalFiles,
        testsAffected,
        riskLevel,
      },
    };
  }

  whatIf(symbolName: string, changeDescription: string): WhatIfScenario {
    const analysis = this.analyze(symbolName);
    const recommendations: string[] = [];

    if (analysis.summary.riskLevel === 'critical') {
      recommendations.push('Consider feature flags for gradual rollout');
      recommendations.push('Ensure comprehensive test coverage');
    } else if (analysis.summary.riskLevel === 'high') {
      recommendations.push('Review all affected files before merge');
    }

    if (analysis.summary.testsAffected === 0 && analysis.summary.totalAffected > 0) {
      recommendations.push('Add tests for affected components');
    }

    return {
      change: changeDescription,
      possibleImpact: analysis,
      recommendations,
      riskScore: this.calculateRiskScore(analysis),
    };
  }

  private calculateRiskScore(analysis: ImpactAnalysis): number {
    const { totalAffected, criticalFiles, testsAffected } = analysis.summary;
    
    let score = 0;
    score += Math.min(0.4, totalAffected * 0.01);
    score += Math.min(0.3, criticalFiles * 0.05);
    score += testsAffected === 0 ? 0.2 : 0;
    
    return Math.min(1, score);
  }

  analyzeChangeSet(symbols: string[]): ImpactAnalysis[] {
    return symbols.map(s => this.analyze(s));
  }

  getImpactGraph(symbol: string, depth: number = 2): Map<string, string[]> {
    const result = new Map<string, string[]>();
    const visited = new Set<string>();
    
    const traverse = (name: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(name)) return;
      visited.add(name);
      
      try {
        const kg = getKnowledgeGraph(this.projectPath);
        const deps = kg.getIncoming(name, 'USES');
        result.set(name, deps.map(d => d.source.name));
        
        for (const dep of deps) {
          traverse(dep.source.name, currentDepth + 1);
        }
      } catch {
        // Knowledge graph not available
      }
    };

    traverse(symbol, 0);
    return result;
  }
}

let instance: ImpactAnalyzer | null = null;

export function getImpactAnalyzer(projectPath?: string): ImpactAnalyzer {
  if (!instance) {
    instance = new ImpactAnalyzer(projectPath);
  }
  return instance;
}

export default ImpactAnalyzer;
