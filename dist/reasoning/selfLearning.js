"use strict";
/**
 * FuncLib v4 - Self-Learning System
 * Feedback'lerden öğren, Copilot kabul/red'lerinden öğren
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfLearning = void 0;
exports.getSelfLearning = getSelfLearning;
class SelfLearning {
    feedbacks = [];
    copilotFeedbacks = [];
    commitFeedbacks = [];
    preferences = new Map();
    rewards = [];
    /**
     * Genel feedback'ten öğren
     */
    learnFromFeedback(feedback) {
        this.feedbacks.push(feedback);
        // Pattern çıkar
        const patterns = this.extractPatterns(feedback);
        for (const pattern of patterns) {
            const weight = this.calculateWeight(feedback);
            this.updatePreference(pattern, weight, feedback.target.content);
        }
    }
    /**
     * Copilot kabul/red'lerinden öğren
     */
    learnFromCopilot(feedback) {
        this.copilotFeedbacks.push(feedback);
        // Kabul edilen önerilerin pattern'larını öğren
        if (feedback.accepted) {
            const patterns = this.extractCodePatterns(feedback.suggestion);
            for (const pattern of patterns) {
                this.updatePreference(pattern, 1.0, feedback.suggestion);
            }
        }
        // Reddedilen önerilerin pattern'larını negatif öğren
        if (!feedback.accepted && !feedback.modified) {
            const patterns = this.extractCodePatterns(feedback.suggestion);
            for (const pattern of patterns) {
                this.updatePreference(pattern, -0.5, feedback.suggestion);
            }
        }
        // Modify edilen önerilerden öğren
        if (feedback.modified && feedback.modifiedContent) {
            // Original → Modified diff'inden öğren
            const originalPatterns = this.extractCodePatterns(feedback.suggestion);
            const modifiedPatterns = this.extractCodePatterns(feedback.modifiedContent);
            // Kaldırılan pattern'lar negatif
            for (const pattern of originalPatterns) {
                if (!modifiedPatterns.includes(pattern)) {
                    this.updatePreference(pattern, -0.3, feedback.suggestion);
                }
            }
            // Eklenen pattern'lar pozitif
            for (const pattern of modifiedPatterns) {
                if (!originalPatterns.includes(pattern)) {
                    this.updatePreference(pattern, 0.8, feedback.modifiedContent);
                }
            }
        }
    }
    /**
     * Commit pattern'larından öğren
     */
    learnFromCommits(feedback) {
        this.commitFeedbacks.push(feedback);
        // Revert edilen commit'ler negatif öğrenme
        if (feedback.reverted) {
            for (const symbol of feedback.changedSymbols) {
                this.updatePreference(`symbol:${symbol}:change`, -1.0, `Reverted change to ${symbol}`);
            }
        }
        // Breaking changes dikkatli olunmalı
        if (feedback.impact === 'breaking') {
            for (const symbol of feedback.changedSymbols) {
                this.updatePreference(`symbol:${symbol}:breaking`, -0.5, `Breaking change to ${symbol}`);
            }
        }
        // Az followup commit = stabil değişiklik
        if (feedback.followupCommits === 0 && feedback.type === 'feat') {
            for (const symbol of feedback.changedSymbols) {
                this.updatePreference(`symbol:${symbol}:stable`, 0.5, `Stable feature in ${symbol}`);
            }
        }
        // Çok followup commit = sorunlu değişiklik
        if (feedback.followupCommits > 3) {
            for (const symbol of feedback.changedSymbols) {
                this.updatePreference(`symbol:${symbol}:unstable`, -0.3, `Unstable change to ${symbol}`);
            }
        }
    }
    /**
     * Reward hesapla
     */
    calculateReward(action, context, outcome) {
        let reward = 0;
        let reason = '';
        switch (outcome) {
            case 'success':
                reward = 1.0;
                reason = 'Action completed successfully';
                break;
            case 'partial':
                reward = 0.3;
                reason = 'Action partially successful';
                break;
            case 'failure':
                reward = -0.5;
                reason = 'Action failed';
                break;
        }
        // Context-based adjustments
        if (context.includes('critical') || context.includes('production')) {
            reward *= 1.5; // Kritik context'lerde reward/penalty daha yüksek
        }
        if (context.includes('test') || context.includes('experimental')) {
            reward *= 0.5; // Test context'lerinde daha düşük
        }
        const signal = { action, context, reward, reason };
        this.rewards.push(signal);
        // Reward'dan öğren
        this.updatePreference(`action:${action}:${context.split(' ')[0]}`, reward, `${action} in ${context}`);
        return signal;
    }
    /**
     * Preference güncelle
     */
    updatePreference(pattern, weight, example) {
        const existing = this.preferences.get(pattern);
        if (existing) {
            // Exponential moving average
            const alpha = 0.3;
            existing.weight = existing.weight * (1 - alpha) + weight * alpha;
            existing.confidence = Math.min(1, existing.confidence + 0.1);
            if (existing.examples.length < 10) {
                existing.examples.push(example);
            }
            existing.lastUpdated = new Date();
        }
        else {
            this.preferences.set(pattern, {
                pattern,
                weight,
                confidence: 0.3,
                examples: [example],
                lastUpdated: new Date(),
            });
        }
    }
    /**
     * Feedback'ten pattern çıkar
     */
    extractPatterns(feedback) {
        const patterns = [];
        const content = feedback.target.content;
        // Action type pattern
        patterns.push(`action:${feedback.target.type}`);
        // Feedback type pattern
        patterns.push(`feedback:${feedback.type}`);
        // İçerik pattern'ları
        if (/async\s+\w+/.test(content)) {
            patterns.push('style:async-function');
        }
        if (/\?\.\w+/.test(content)) {
            patterns.push('style:optional-chaining');
        }
        if (/\w+\s*\?\?/.test(content)) {
            patterns.push('style:nullish-coalescing');
        }
        if (/try\s*{/.test(content)) {
            patterns.push('style:try-catch');
        }
        if (/interface\s+\w+/.test(content)) {
            patterns.push('style:typescript-interface');
        }
        return patterns;
    }
    /**
     * Kod'dan pattern çıkar
     */
    extractCodePatterns(code) {
        const patterns = [];
        // Function style
        if (/^const\s+\w+\s*=\s*\(/.test(code)) {
            patterns.push('style:arrow-function');
        }
        if (/^function\s+\w+/.test(code)) {
            patterns.push('style:function-declaration');
        }
        if (/^async\s+/.test(code)) {
            patterns.push('style:async');
        }
        // Error handling
        if (/try\s*{/.test(code)) {
            patterns.push('pattern:try-catch');
        }
        if (/\.catch\(/.test(code)) {
            patterns.push('pattern:promise-catch');
        }
        // Null safety
        if (/\?\.\w+/.test(code)) {
            patterns.push('pattern:optional-chaining');
        }
        if (/\?\?/.test(code)) {
            patterns.push('pattern:nullish-coalescing');
        }
        if (/!= null|!== null/.test(code)) {
            patterns.push('pattern:null-check');
        }
        // TypeScript
        if (/:\s*(string|number|boolean|void|any|unknown)/.test(code)) {
            patterns.push('pattern:primitive-types');
        }
        if (/:\s*\w+\[\]/.test(code)) {
            patterns.push('pattern:array-type');
        }
        if (/<\w+>/.test(code)) {
            patterns.push('pattern:generic');
        }
        // Imports
        if (/^import\s+/.test(code)) {
            patterns.push('pattern:import');
        }
        if (/import\s+type\s+/.test(code)) {
            patterns.push('pattern:type-import');
        }
        // Vue patterns
        if (/defineComponent|defineProps|defineEmits/.test(code)) {
            patterns.push('pattern:vue-composition');
        }
        if (/ref\(|reactive\(|computed\(/.test(code)) {
            patterns.push('pattern:vue-reactivity');
        }
        return patterns;
    }
    /**
     * Feedback'e göre weight hesapla
     */
    calculateWeight(feedback) {
        switch (feedback.type) {
            case 'accept':
                return 1.0;
            case 'reject':
                return -1.0;
            case 'modify':
                return 0.5;
            case 'undo':
                return -0.8;
            case 'rating':
                return ((feedback.value || 3) - 3) / 2; // 1-5 → -1 to 1
            default:
                return 0;
        }
    }
    /**
     * Tercih edilen pattern mi?
     */
    isPreferred(pattern) {
        const pref = this.preferences.get(pattern);
        return pref ? pref.weight > 0.3 && pref.confidence > 0.5 : false;
    }
    /**
     * Kaçınılan pattern mi?
     */
    isAvoided(pattern) {
        const pref = this.preferences.get(pattern);
        return pref ? pref.weight < -0.3 && pref.confidence > 0.5 : false;
    }
    /**
     * Pattern önerileri al
     */
    getPatternSuggestions(context) {
        const suggestions = [];
        // Yüksek weight'li pattern'ları öner
        const sorted = Array.from(this.preferences.values())
            .filter(p => p.weight > 0.5 && p.confidence > 0.4)
            .sort((a, b) => b.weight - a.weight);
        for (const pref of sorted.slice(0, 5)) {
            suggestions.push(`Consider using ${pref.pattern}: ${pref.examples[0]?.slice(0, 50)}...`);
        }
        return suggestions;
    }
    /**
     * Öğrenme istatistikleri
     */
    getStats() {
        const accepted = this.feedbacks.filter(f => f.type === 'accept').length;
        const total = this.feedbacks.length;
        const topPatterns = Array.from(this.preferences.values())
            .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
            .slice(0, 10);
        const avgReward = this.rewards.length > 0
            ? this.rewards.reduce((sum, r) => sum + r.reward, 0) / this.rewards.length
            : 0;
        // Learning velocity: Son 100 feedback'teki değişim
        const recentFeedbacks = this.feedbacks.slice(-100);
        const recentAccepted = recentFeedbacks.filter(f => f.type === 'accept').length;
        const learningVelocity = recentFeedbacks.length > 0
            ? recentAccepted / recentFeedbacks.length - (total > 0 ? accepted / total : 0)
            : 0;
        return {
            totalFeedbacks: total,
            acceptanceRate: total > 0 ? accepted / total : 0,
            topPatterns,
            avgReward,
            learningVelocity,
        };
    }
    /**
     * Preference'ları export et
     */
    exportPreferences() {
        const result = {};
        for (const [key, value] of this.preferences) {
            result[key] = value;
        }
        return result;
    }
    /**
     * Preference'ları import et
     */
    importPreferences(prefs) {
        for (const [key, value] of Object.entries(prefs)) {
            this.preferences.set(key, value);
        }
    }
    /**
     * Copilot acceptance rate
     */
    getCopilotAcceptanceRate() {
        const total = this.copilotFeedbacks.length;
        const accepted = this.copilotFeedbacks.filter(f => f.accepted).length;
        // Group by file extension
        const byContext = new Map();
        const contextCounts = new Map();
        for (const fb of this.copilotFeedbacks) {
            const ext = fb.context.file.split('.').pop() || 'unknown';
            const current = contextCounts.get(ext) || { accepted: 0, total: 0 };
            current.total++;
            if (fb.accepted)
                current.accepted++;
            contextCounts.set(ext, current);
        }
        for (const [ext, counts] of contextCounts) {
            byContext.set(ext, counts.total > 0 ? counts.accepted / counts.total : 0);
        }
        return {
            overall: total > 0 ? accepted / total : 0,
            byContext,
        };
    }
    /**
     * Commit stability score
     */
    getCommitStabilityScore() {
        if (this.commitFeedbacks.length === 0)
            return 0.5;
        let score = 0.5;
        for (const fb of this.commitFeedbacks) {
            if (fb.reverted)
                score -= 0.1;
            if (fb.impact === 'breaking')
                score -= 0.05;
            if (fb.followupCommits === 0)
                score += 0.02;
            if (fb.followupCommits > 3)
                score -= 0.03;
        }
        return Math.max(0, Math.min(1, score));
    }
}
exports.SelfLearning = SelfLearning;
// Singleton
let selfLearning = null;
function getSelfLearning() {
    if (!selfLearning) {
        selfLearning = new SelfLearning();
    }
    return selfLearning;
}
exports.default = SelfLearning;
//# sourceMappingURL=selfLearning.js.map