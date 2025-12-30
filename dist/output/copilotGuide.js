"use strict";
/**
 * FuncLib v4 - Copilot Guide
 * GitHub Copilot için bağlam hazırla ve önerileri değerlendir
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotGuide = void 0;
exports.getCopilotGuide = getCopilotGuide;
const knowledgeGraph_1 = require("../memory/knowledgeGraph");
const crossProjectKB_1 = require("../memory/crossProjectKB");
class CopilotGuide {
    projectPath;
    constructor(projectPath) {
        this.projectPath = projectPath || process.cwd();
    }
    prepareContext(symbolName) {
        const relatedSymbols = [];
        const warnings = [];
        const patterns = [];
        let currentSymbol;
        // Get related symbols
        if (symbolName) {
            try {
                const graph = (0, knowledgeGraph_1.getKnowledgeGraph)(this.projectPath);
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
            }
            catch {
                // Knowledge graph not available
            }
        }
        // Get patterns from cross-project KB
        try {
            const kb = (0, crossProjectKB_1.getCrossProjectKB)();
            const usedPatterns = kb.getMostUsedPatterns();
            for (const p of usedPatterns.slice(0, 5)) {
                patterns.push({
                    name: p.name,
                    description: p.description,
                    example: p.code,
                    frequency: p.frequency,
                });
            }
        }
        catch {
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
    evaluateSuggestion(suggestion, context) {
        const reasons = [];
        const alternatives = [];
        const warnings = [];
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
    suggestAlternatives(suggestion, context) {
        const alternatives = [];
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
    warnIfRisky(code) {
        const warnings = [];
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
    getProjectName() {
        const parts = this.projectPath.split(/[/\\]/);
        return parts[parts.length - 1] || 'unknown';
    }
    generateGuidance(symbolName) {
        const context = this.prepareContext(symbolName);
        const lines = [];
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
exports.CopilotGuide = CopilotGuide;
let instance = null;
function getCopilotGuide(projectPath) {
    if (!instance) {
        instance = new CopilotGuide(projectPath);
    }
    return instance;
}
exports.default = CopilotGuide;
//# sourceMappingURL=copilotGuide.js.map