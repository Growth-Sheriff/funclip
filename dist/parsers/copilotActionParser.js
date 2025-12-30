"use strict";
/**
 * FuncLib v4 - Copilot Action Parser
 * Copilot önerilerini analiz et, pattern öğren
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotActionParser = void 0;
exports.getCopilotActionParser = getCopilotActionParser;
class CopilotActionParser {
    patterns = new Map();
    /**
     * Copilot önerisini analiz et
     */
    analyzeSuggestion(action) {
        const changeType = this.detectChangeType(action);
        const affectedSymbols = this.extractAffectedSymbols(action);
        const risks = this.detectRisks(action);
        const quality = this.evaluateQuality(action);
        const pattern = this.extractPattern(action);
        const complexity = this.assessComplexity(action);
        return {
            changeType,
            affectedSymbols,
            risks,
            pattern,
            quality,
            complexity,
        };
    }
    /**
     * Değişiklik tipini tespit et
     */
    detectChangeType(action) {
        const original = action.originalCode.trim();
        const suggested = action.suggestedCode.trim();
        // Boş satıra ekleme
        if (!original && suggested) {
            return 'add';
        }
        // Silme
        if (original && !suggested) {
            return 'delete';
        }
        // Autocomplete (satır tamamlama)
        if (suggested.startsWith(original) || original.length < 5) {
            return 'complete';
        }
        // Refactor (yapısal değişiklik)
        const originalLines = original.split('\n').length;
        const suggestedLines = suggested.split('\n').length;
        if (Math.abs(originalLines - suggestedLines) > 3) {
            return 'refactor';
        }
        return 'modify';
    }
    /**
     * Etkilenen sembolleri çıkar
     */
    extractAffectedSymbols(action) {
        const symbols = [];
        const code = action.suggestedCode;
        // Function declarations
        const funcMatches = code.matchAll(/(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s*)?\(|[(<])/g);
        for (const match of funcMatches) {
            symbols.push({
                name: match[1],
                kind: 'function',
                isNew: !action.originalCode.includes(match[1]),
            });
        }
        // Class declarations
        const classMatches = code.matchAll(/class\s+(\w+)/g);
        for (const match of classMatches) {
            symbols.push({
                name: match[1],
                kind: 'class',
                isNew: !action.originalCode.includes(match[1]),
            });
        }
        // Variable declarations
        const varMatches = code.matchAll(/(?:const|let|var)\s+(\w+)\s*=/g);
        for (const match of varMatches) {
            // Function olarak zaten eklenmediyse
            if (!symbols.some(s => s.name === match[1])) {
                symbols.push({
                    name: match[1],
                    kind: 'variable',
                    isNew: !action.originalCode.includes(match[1]),
                });
            }
        }
        // Import statements
        const importMatches = code.matchAll(/import\s+(?:{([^}]+)}|(\w+))/g);
        for (const match of importMatches) {
            const imports = (match[1] || match[2]).split(',').map(s => s.trim());
            for (const imp of imports) {
                if (imp) {
                    symbols.push({
                        name: imp,
                        kind: 'import',
                        isNew: true,
                    });
                }
            }
        }
        // Type/Interface declarations
        const typeMatches = code.matchAll(/(?:type|interface)\s+(\w+)/g);
        for (const match of typeMatches) {
            symbols.push({
                name: match[1],
                kind: 'type',
                isNew: !action.originalCode.includes(match[1]),
            });
        }
        return symbols;
    }
    /**
     * Riskleri tespit et
     */
    detectRisks(action) {
        const risks = [];
        const code = action.suggestedCode;
        // Null reference risk
        if (/\.\w+/.test(code) && !/\?\.\w+/.test(code) && !/!\./.test(code)) {
            if (/(?:null|undefined)\b/.test(action.context.surroundingCode)) {
                risks.push({
                    type: 'null_reference',
                    severity: 'medium',
                    description: 'Potential null reference without optional chaining',
                    suggestion: 'Consider using optional chaining (?.) for safety',
                });
            }
        }
        // Missing await
        if (/\basync\b/.test(code) && /\bawait\b/.test(code) === false) {
            const promisePatterns = /fetch\(|\.then\(|Promise\./;
            if (promisePatterns.test(code)) {
                risks.push({
                    type: 'logic_error',
                    severity: 'high',
                    description: 'Async function without await may not work as expected',
                    suggestion: 'Add await before async operations',
                });
            }
        }
        // Security risks
        const securityPatterns = [
            { pattern: /eval\s*\(/, risk: 'eval() usage is dangerous' },
            { pattern: /innerHTML\s*=/, risk: 'innerHTML can lead to XSS' },
            { pattern: /dangerouslySetInnerHTML/, risk: 'Direct HTML insertion risk' },
            { pattern: /\.exec\s*\(.*user|input/i, risk: 'Potential command injection' },
        ];
        for (const { pattern, risk } of securityPatterns) {
            if (pattern.test(code)) {
                risks.push({
                    type: 'security',
                    severity: 'high',
                    description: risk,
                });
            }
        }
        // Performance risks
        const perfPatterns = [
            { pattern: /for\s*\([^)]*\)\s*{[^}]*await/, risk: 'Await inside loop - consider Promise.all' },
            { pattern: /\.forEach\(.*await/, risk: 'Await in forEach doesn\'t work as expected' },
            { pattern: /JSON\.parse\(JSON\.stringify/, risk: 'Deep clone is slow, use structuredClone' },
        ];
        for (const { pattern, risk } of perfPatterns) {
            if (pattern.test(code)) {
                risks.push({
                    type: 'performance',
                    severity: 'medium',
                    description: risk,
                });
            }
        }
        // Missing error handling
        if (/\bawait\b/.test(code) && !/\btry\b/.test(code) && !/\.catch\(/.test(code)) {
            risks.push({
                type: 'logic_error',
                severity: 'low',
                description: 'Async operation without error handling',
                suggestion: 'Consider adding try-catch or .catch()',
            });
        }
        // Type errors (basic heuristics)
        if (/:\s*any\b/.test(code)) {
            risks.push({
                type: 'type_error',
                severity: 'low',
                description: 'Using "any" type loses type safety',
                suggestion: 'Consider using a more specific type',
            });
        }
        return risks;
    }
    /**
     * Kalite değerlendirmesi
     */
    evaluateQuality(action) {
        const code = action.suggestedCode;
        const issues = [];
        // Readability
        let readability = 1.0;
        const lines = code.split('\n');
        const avgLineLength = lines.reduce((sum, l) => sum + l.length, 0) / Math.max(lines.length, 1);
        if (avgLineLength > 100) {
            readability -= 0.2;
            issues.push('Lines too long (>100 chars)');
        }
        if (lines.length > 50) {
            readability -= 0.1;
            issues.push('Function may be too long');
        }
        // Maintainability
        let maintainability = 1.0;
        const complexityIndicators = (code.match(/if|else|for|while|switch|catch|\?|&&|\|\|/g) || []).length;
        if (complexityIndicators > 10) {
            maintainability -= 0.3;
            issues.push('High cyclomatic complexity');
        }
        // Nested callbacks/promises
        const nestingLevel = (code.match(/\{/g) || []).length;
        if (nestingLevel > 5) {
            maintainability -= 0.2;
            issues.push('Deep nesting detected');
        }
        // Correctness (heuristics)
        let correctness = 1.0;
        if (/console\.log/.test(code)) {
            correctness -= 0.1;
            issues.push('Contains console.log');
        }
        if (/TODO|FIXME|HACK/i.test(code)) {
            correctness -= 0.1;
            issues.push('Contains TODO/FIXME markers');
        }
        // Efficiency
        let efficiency = 1.0;
        if (/\.filter\([^)]+\)\.map\(/.test(code)) {
            efficiency -= 0.1;
            issues.push('Could use reduce instead of filter+map');
        }
        if (/new Array\(\d+\)/.test(code) && !/\.fill\(/.test(code)) {
            efficiency -= 0.1;
            issues.push('Creating sparse array');
        }
        // Style
        let style = 1.0;
        if (/var\s/.test(code)) {
            style -= 0.2;
            issues.push('Using var instead of const/let');
        }
        if (/function\s*\(/.test(code) && !/=>\s*{?/.test(code) && lines.length < 5) {
            style -= 0.1;
            issues.push('Consider arrow function for short functions');
        }
        // Clamp values
        const clamp = (v) => Math.max(0, Math.min(1, v));
        readability = clamp(readability);
        maintainability = clamp(maintainability);
        correctness = clamp(correctness);
        efficiency = clamp(efficiency);
        style = clamp(style);
        const overall = (readability + maintainability + correctness + efficiency + style) / 5;
        return {
            overall,
            readability,
            maintainability,
            correctness,
            efficiency,
            style,
            issues,
        };
    }
    /**
     * Pattern çıkar
     */
    extractPattern(action) {
        // Sadece kabul edilmiş aksiyonlardan pattern çıkar
        if (action.type !== 'accept')
            return null;
        // Trigger'ı belirle (önceki satırlar)
        const trigger = this.extractTrigger(action);
        if (!trigger)
            return null;
        // Kategori belirle
        const category = this.categorizePattern(action);
        // Pattern ID
        const id = `pat_${this.hashCode(trigger)}`;
        // Mevcut pattern varsa güncelle
        if (this.patterns.has(id)) {
            const existing = this.patterns.get(id);
            existing.frequency++;
            existing.confidence = Math.min(1, existing.confidence + 0.1);
            return existing;
        }
        // Yeni pattern oluştur
        const pattern = {
            id,
            trigger,
            suggestion: action.suggestedCode.substring(0, 200),
            category,
            confidence: 0.5,
            frequency: 1,
            source: 'copilot',
        };
        this.patterns.set(id, pattern);
        return pattern;
    }
    /**
     * Trigger çıkar
     */
    extractTrigger(action) {
        const context = action.context.surroundingCode;
        const lines = context.split('\n');
        // Son 2-3 satır trigger olarak kullanılır
        return lines.slice(-3).join('\n').trim().substring(0, 100);
    }
    /**
     * Pattern kategorisi belirle
     */
    categorizePattern(action) {
        const code = action.suggestedCode;
        if (/import\s/.test(code))
            return 'import';
        if (/export\s/.test(code))
            return 'export';
        if (/function|=>/.test(code))
            return 'function';
        if (/class\s/.test(code))
            return 'class';
        if (/if\s*\(|switch\s*\(/.test(code))
            return 'control-flow';
        if (/try\s*{|catch\s*\(/.test(code))
            return 'error-handling';
        if (/async|await|Promise/.test(code))
            return 'async';
        if (/\.(map|filter|reduce|forEach)\(/.test(code))
            return 'array-operation';
        if (/useState|useEffect|useRef/.test(code))
            return 'react-hook';
        if (/ref\(|computed\(|watch\(/.test(code))
            return 'vue-composition';
        return 'general';
    }
    /**
     * Complexity değerlendirmesi
     */
    assessComplexity(action) {
        const code = action.suggestedCode;
        const lines = code.split('\n').length;
        const controlStructures = (code.match(/if|else|for|while|switch|try|catch/g) || []).length;
        const functions = (code.match(/function|=>/g) || []).length;
        const score = lines + (controlStructures * 2) + (functions * 3);
        if (score <= 5)
            return 'trivial';
        if (score <= 15)
            return 'simple';
        if (score <= 40)
            return 'moderate';
        return 'complex';
    }
    /**
     * Öğrenilen pattern'ları getir
     */
    getLearnedPatterns() {
        return Array.from(this.patterns.values())
            .filter(p => p.frequency > 2)
            .sort((a, b) => b.confidence - a.confidence);
    }
    /**
     * Benzer pattern bul
     */
    findSimilarPattern(context) {
        let bestMatch = null;
        let bestScore = 0;
        for (const pattern of this.patterns.values()) {
            const score = this.similarity(context, pattern.trigger);
            if (score > bestScore && score > 0.6) {
                bestScore = score;
                bestMatch = pattern;
            }
        }
        return bestMatch;
    }
    /**
     * Basit string similarity
     */
    similarity(a, b) {
        if (a === b)
            return 1;
        if (!a || !b)
            return 0;
        const aWords = new Set(a.toLowerCase().split(/\W+/));
        const bWords = new Set(b.toLowerCase().split(/\W+/));
        let intersection = 0;
        for (const word of aWords) {
            if (bWords.has(word))
                intersection++;
        }
        return (2 * intersection) / (aWords.size + bWords.size);
    }
    /**
     * Simple hash code
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
}
exports.CopilotActionParser = CopilotActionParser;
// Singleton
let copilotActionParser = null;
function getCopilotActionParser() {
    if (!copilotActionParser) {
        copilotActionParser = new CopilotActionParser();
    }
    return copilotActionParser;
}
exports.default = CopilotActionParser;
//# sourceMappingURL=copilotActionParser.js.map