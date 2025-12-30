/**
 * FuncLib v4 - Copilot Guide
 * GitHub Copilot için bağlam hazırla ve önerileri değerlendir
 */
export interface CopilotContext {
    currentSymbol?: SymbolContext;
    relatedSymbols: SymbolContext[];
    patterns: PatternContext[];
    warnings: Warning[];
    recentChanges: ChangeContext[];
    metadata: {
        projectName: string;
        language: string;
        framework?: string;
    };
}
export interface SymbolContext {
    name: string;
    kind: string;
    signature?: string;
    docstring?: string;
    file: string;
    dependencies: string[];
    dependents: string[];
}
export interface ChangeContext {
    symbol: string;
    type: 'added' | 'modified' | 'deleted';
    date: Date;
    author?: string;
}
export interface PatternContext {
    name: string;
    description: string;
    example?: string;
    frequency: number;
}
export interface Warning {
    type: 'breaking' | 'deprecated' | 'security' | 'performance' | 'style';
    message: string;
    severity: 'info' | 'warning' | 'error';
    symbol?: string;
}
export interface SuggestionEvaluation {
    accepted: boolean;
    score: number;
    reasons: string[];
    alternatives: string[];
    warnings: Warning[];
}
export declare class CopilotGuide {
    private projectPath;
    constructor(projectPath?: string);
    prepareContext(symbolName?: string): CopilotContext;
    evaluateSuggestion(suggestion: string, context: CopilotContext): SuggestionEvaluation;
    suggestAlternatives(suggestion: string, context: CopilotContext): string[];
    warnIfRisky(code: string): Warning[];
    private getProjectName;
    generateGuidance(symbolName: string): string;
}
export declare function getCopilotGuide(projectPath?: string): CopilotGuide;
export default CopilotGuide;
