"use strict";
/**
 * FuncLib v4 - Commit Parser
 * Conventional commits parsing, intent extraction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommitParser = void 0;
exports.getCommitParser = getCommitParser;
// Conventional commit types
const COMMIT_TYPES = {
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
    { regex: /(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s*[:#]?\s*(\d+)/gi, type: 'fixes' },
    { regex: /(?:ref(?:erence)?s?|relates?\s*to)\s*[:#]?\s*(\d+)/gi, type: 'references' },
    { regex: /#(\d+)/g, type: 'references' },
];
// Breaking change indicators
const BREAKING_INDICATORS = [
    /BREAKING[\s-]?CHANGE/i,
    /\bbreaking\b/i,
    /!:/,
    /\bmajor\b.*\bchange\b/i,
];
class CommitParser {
    /**
     * Conventional commit parse et
     */
    parseConventional(message) {
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
            let breakingDescription;
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
    extractIntent(message, changedFiles = []) {
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
    extractIssueRefs(message) {
        const refs = [];
        const seen = new Set();
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
    detectBreakingChanges(message, diff) {
        const changes = [];
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
    analyzeCommitHistory(messages) {
        const types = {};
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
    inferType(message) {
        const lower = message.toLowerCase();
        if (/\b(add|new|feature|implement|create)\b/.test(lower))
            return 'feature';
        if (/\b(fix|bug|issue|error|crash|problem)\b/.test(lower))
            return 'bugfix';
        if (/\b(refactor|clean|simplify|restructure)\b/.test(lower))
            return 'refactor';
        if (/\b(doc|readme|comment|jsdoc)\b/.test(lower))
            return 'docs';
        if (/\b(test|spec|coverage)\b/.test(lower))
            return 'test';
        if (/\b(perf|performance|optimize|speed|fast)\b/.test(lower))
            return 'perf';
        if (/\b(style|format|lint|prettier|eslint)\b/.test(lower))
            return 'style';
        if (/\b(ci|deploy|pipeline|workflow|github\s*action)\b/.test(lower))
            return 'ci';
        if (/\b(build|webpack|vite|rollup|bundle|deps|dependency)\b/.test(lower))
            return 'build';
        if (/\brevert\b/.test(lower))
            return 'revert';
        return 'chore';
    }
    /**
     * Scope infer et
     */
    inferScope(message, files) {
        // Dosyalardan scope çıkar
        if (files.length > 0) {
            const dirs = files.map(f => {
                const parts = f.split('/');
                return parts.length > 1 ? parts[0] : '';
            }).filter(Boolean);
            // En çok tekrar eden directory
            const counts = {};
            for (const dir of dirs) {
                counts[dir] = (counts[dir] || 0) + 1;
            }
            const topDir = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            if (topDir)
                return topDir[0];
        }
        // Mesajdan scope çıkar
        const scopeMatch = message.match(/\b(api|ui|auth|editor|store|utils?|lib|core|config|types?|models?|services?|components?)\b/i);
        if (scopeMatch)
            return scopeMatch[1].toLowerCase();
        return '';
    }
    /**
     * Affected symbols çıkar
     */
    extractAffectedSymbols(message) {
        const symbols = [];
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
    calculateConfidence(conventional, files) {
        let confidence = 0.5;
        // Conventional format kullanılmış
        if (conventional.type !== 'unknown')
            confidence += 0.2;
        // Scope var
        if (conventional.scope)
            confidence += 0.1;
        // Description yeterli uzunlukta
        if (conventional.description.length > 10)
            confidence += 0.1;
        // Body var
        if (conventional.body)
            confidence += 0.1;
        return Math.min(1, confidence);
    }
    /**
     * Priority hesapla
     */
    calculatePriority(type, breaking) {
        if (breaking)
            return 'critical';
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
    extractAffectedAreas(message, diff) {
        const areas = [];
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
    findBreakingPatterns(diff) {
        const patterns = [];
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
exports.CommitParser = CommitParser;
// Singleton instance
let commitParser = null;
function getCommitParser() {
    if (!commitParser) {
        commitParser = new CommitParser();
    }
    return commitParser;
}
exports.default = CommitParser;
//# sourceMappingURL=commitParser.js.map