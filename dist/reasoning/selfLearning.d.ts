/**
 * FuncLib v4 - Self-Learning System
 * Feedback'lerden öğren, Copilot kabul/red'lerinden öğren
 */
export interface Feedback {
    id: string;
    type: 'accept' | 'reject' | 'modify' | 'undo' | 'rating';
    target: {
        type: 'suggestion' | 'refactor' | 'fix' | 'completion';
        content: string;
        context?: string;
    };
    value?: number;
    reason?: string;
    timestamp: Date;
    user?: string;
}
export interface CopilotFeedback {
    suggestion: string;
    accepted: boolean;
    modified?: boolean;
    modifiedContent?: string;
    context: {
        file: string;
        line: number;
        prefix: string;
        suffix: string;
    };
    timestamp: Date;
}
export interface CommitFeedback {
    hash: string;
    type: 'feat' | 'fix' | 'refactor' | 'revert' | 'other';
    changedSymbols: string[];
    impact: 'breaking' | 'major' | 'minor' | 'patch';
    followupCommits: number;
    reverted: boolean;
}
export interface LearnedPreference {
    pattern: string;
    weight: number;
    confidence: number;
    examples: string[];
    lastUpdated: Date;
}
export interface RewardSignal {
    action: string;
    context: string;
    reward: number;
    reason: string;
}
export interface LearningStats {
    totalFeedbacks: number;
    acceptanceRate: number;
    topPatterns: LearnedPreference[];
    avgReward: number;
    learningVelocity: number;
}
export declare class SelfLearning {
    private feedbacks;
    private copilotFeedbacks;
    private commitFeedbacks;
    private preferences;
    private rewards;
    /**
     * Genel feedback'ten öğren
     */
    learnFromFeedback(feedback: Feedback): void;
    /**
     * Copilot kabul/red'lerinden öğren
     */
    learnFromCopilot(feedback: CopilotFeedback): void;
    /**
     * Commit pattern'larından öğren
     */
    learnFromCommits(feedback: CommitFeedback): void;
    /**
     * Reward hesapla
     */
    calculateReward(action: string, context: string, outcome: 'success' | 'failure' | 'partial'): RewardSignal;
    /**
     * Preference güncelle
     */
    private updatePreference;
    /**
     * Feedback'ten pattern çıkar
     */
    private extractPatterns;
    /**
     * Kod'dan pattern çıkar
     */
    private extractCodePatterns;
    /**
     * Feedback'e göre weight hesapla
     */
    private calculateWeight;
    /**
     * Tercih edilen pattern mi?
     */
    isPreferred(pattern: string): boolean;
    /**
     * Kaçınılan pattern mi?
     */
    isAvoided(pattern: string): boolean;
    /**
     * Pattern önerileri al
     */
    getPatternSuggestions(context: string): string[];
    /**
     * Öğrenme istatistikleri
     */
    getStats(): LearningStats;
    /**
     * Preference'ları export et
     */
    exportPreferences(): Record<string, LearnedPreference>;
    /**
     * Preference'ları import et
     */
    importPreferences(prefs: Record<string, LearnedPreference>): void;
    /**
     * Copilot acceptance rate
     */
    getCopilotAcceptanceRate(): {
        overall: number;
        byContext: Map<string, number>;
    };
    /**
     * Commit stability score
     */
    getCommitStabilityScore(): number;
}
export declare function getSelfLearning(): SelfLearning;
export default SelfLearning;
