"use strict";
/**
 * FuncLib v4 - Impact Analyzer
 * Değişikliklerin etkisini analiz et
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpactAnalyzer = void 0;
exports.getImpactAnalyzer = getImpactAnalyzer;
const knowledgeGraph_1 = require("../memory/knowledgeGraph");
class ImpactAnalyzer {
    projectPath;
    constructor(projectPath) {
        this.projectPath = projectPath || process.cwd();
    }
    analyze(symbol) {
        const symbolName = typeof symbol === 'string' ? symbol : symbol.name;
        const directImpact = [];
        const transitiveImpact = [];
        const testImpact = [];
        try {
            const graph = (0, knowledgeGraph_1.getKnowledgeGraph)(this.projectPath);
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
        }
        catch {
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
        let riskLevel = 'low';
        if (totalAffected > 50)
            riskLevel = 'critical';
        else if (totalAffected > 20)
            riskLevel = 'high';
        else if (totalAffected > 5)
            riskLevel = 'medium';
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
    whatIf(symbolName, changeDescription) {
        const analysis = this.analyze(symbolName);
        const recommendations = [];
        if (analysis.summary.riskLevel === 'critical') {
            recommendations.push('Consider feature flags for gradual rollout');
            recommendations.push('Ensure comprehensive test coverage');
        }
        else if (analysis.summary.riskLevel === 'high') {
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
    calculateRiskScore(analysis) {
        const { totalAffected, criticalFiles, testsAffected } = analysis.summary;
        let score = 0;
        score += Math.min(0.4, totalAffected * 0.01);
        score += Math.min(0.3, criticalFiles * 0.05);
        score += testsAffected === 0 ? 0.2 : 0;
        return Math.min(1, score);
    }
    analyzeChangeSet(symbols) {
        return symbols.map(s => this.analyze(s));
    }
    getImpactGraph(symbol, depth = 2) {
        const result = new Map();
        const visited = new Set();
        const traverse = (name, currentDepth) => {
            if (currentDepth > depth || visited.has(name))
                return;
            visited.add(name);
            try {
                const kg = (0, knowledgeGraph_1.getKnowledgeGraph)(this.projectPath);
                const deps = kg.getIncoming(name, 'USES');
                result.set(name, deps.map(d => d.source.name));
                for (const dep of deps) {
                    traverse(dep.source.name, currentDepth + 1);
                }
            }
            catch {
                // Knowledge graph not available
            }
        };
        traverse(symbol, 0);
        return result;
    }
}
exports.ImpactAnalyzer = ImpactAnalyzer;
let instance = null;
function getImpactAnalyzer(projectPath) {
    if (!instance) {
        instance = new ImpactAnalyzer(projectPath);
    }
    return instance;
}
exports.default = ImpactAnalyzer;
//# sourceMappingURL=impactAnalyzer.js.map