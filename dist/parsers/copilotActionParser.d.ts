/**
 * FuncLib v4 - Copilot Action Parser
 * Copilot önerilerini analiz et, pattern öğren
 */
import { CopilotAction } from '../collectors/copilotCollector';
export interface SuggestionAnalysis {
    changeType: 'add' | 'modify' | 'delete' | 'refactor' | 'complete';
    affectedSymbols: SymbolInfo[];
    risks: Risk[];
    pattern: LearnedPattern | null;
    quality: QualityScore;
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
}
export interface SymbolInfo {
    name: string;
    kind: 'function' | 'class' | 'variable' | 'type' | 'import' | 'unknown';
    line?: number;
    isNew: boolean;
}
export interface Risk {
    type: 'null_reference' | 'type_error' | 'missing_import' | 'security' | 'performance' | 'logic_error' | 'style';
    severity: 'low' | 'medium' | 'high';
    description: string;
    location?: {
        line: number;
        column: number;
    };
    suggestion?: string;
}
export interface LearnedPattern {
    id: string;
    trigger: string;
    suggestion: string;
    category: string;
    confidence: number;
    frequency: number;
    source: 'copilot' | 'user' | 'learned';
}
export interface QualityScore {
    overall: number;
    readability: number;
    maintainability: number;
    correctness: number;
    efficiency: number;
    style: number;
    issues: string[];
}
export declare class CopilotActionParser {
    private patterns;
    /**
     * Copilot önerisini analiz et
     */
    analyzeSuggestion(action: CopilotAction): SuggestionAnalysis;
    /**
     * Değişiklik tipini tespit et
     */
    private detectChangeType;
    /**
     * Etkilenen sembolleri çıkar
     */
    private extractAffectedSymbols;
    /**
     * Riskleri tespit et
     */
    private detectRisks;
    /**
     * Kalite değerlendirmesi
     */
    evaluateQuality(action: CopilotAction): QualityScore;
    /**
     * Pattern çıkar
     */
    private extractPattern;
    /**
     * Trigger çıkar
     */
    private extractTrigger;
    /**
     * Pattern kategorisi belirle
     */
    private categorizePattern;
    /**
     * Complexity değerlendirmesi
     */
    private assessComplexity;
    /**
     * Öğrenilen pattern'ları getir
     */
    getLearnedPatterns(): LearnedPattern[];
    /**
     * Benzer pattern bul
     */
    findSimilarPattern(context: string): LearnedPattern | null;
    /**
     * Basit string similarity
     */
    private similarity;
    /**
     * Simple hash code
     */
    private hashCode;
}
export declare function getCopilotActionParser(): CopilotActionParser;
export default CopilotActionParser;
