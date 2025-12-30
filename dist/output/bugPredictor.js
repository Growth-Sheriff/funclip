"use strict";
/**
 * FuncLib v4 - Bug Predictor
 * Potansiyel bug'ları tespit et, risk skorları hesapla
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BugPredictor = void 0;
exports.getBugPredictor = getBugPredictor;
const knowledgeGraph_1 = require("../memory/knowledgeGraph");
class BugPredictor {
    projectPath;
    riskyPatterns = [
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
    constructor(projectPath) {
        this.projectPath = projectPath || process.cwd();
    }
    predictBugs(symbol, code) {
        const predictions = [];
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
            const graph = (0, knowledgeGraph_1.getKnowledgeGraph)(this.projectPath);
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
        }
        catch {
            // Knowledge graph not available
        }
        return predictions.sort((a, b) => b.score - a.score);
    }
    riskToScore(risk) {
        switch (risk) {
            case 'critical': return 0.95;
            case 'high': return 0.75;
            case 'medium': return 0.5;
            case 'low': return 0.25;
        }
    }
    calculateRiskScore(symbol, code) {
        const factors = [];
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
            const graph = (0, knowledgeGraph_1.getKnowledgeGraph)(this.projectPath);
            const deps = graph.getOutgoing(symbol.name, 'USES');
            factors.push({
                name: 'Dependencies',
                weight: 0.5,
                score: Math.min(1, deps.length / 20),
            });
        }
        catch {
            factors.push({
                name: 'Dependencies',
                weight: 0.5,
                score: 0.3,
            });
        }
        const overall = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
        const mitigations = [];
        if (overall > 0.5) {
            mitigations.push('Consider code review for high-risk areas');
        }
        return { overall, factors, mitigations };
    }
    findHotspots(files, limit = 10) {
        const hotspots = files.map(file => ({
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
    addPattern(pattern) {
        this.riskyPatterns.push(pattern);
    }
    listPatterns() {
        return this.riskyPatterns.map(p => ({
            type: p.type,
            risk: p.risk,
            reason: p.reason,
        }));
    }
}
exports.BugPredictor = BugPredictor;
let instance = null;
function getBugPredictor(projectPath) {
    if (!instance) {
        instance = new BugPredictor(projectPath);
    }
    return instance;
}
exports.default = BugPredictor;
//# sourceMappingURL=bugPredictor.js.map