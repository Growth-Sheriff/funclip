/**
 * FuncLib v4 - Cross-Project Knowledge Base
 * Pattern repository, best practices, anti-patterns
 */
export interface Pattern {
    id: string;
    name: string;
    category: PatternCategory;
    language: string;
    description: string;
    code: string;
    usage: string;
    frequency: number;
    confidence: number;
    projects: string[];
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
export type PatternCategory = 'design-pattern' | 'code-pattern' | 'api-pattern' | 'error-handling' | 'async-pattern' | 'state-management' | 'testing-pattern' | 'security-pattern' | 'performance-pattern' | 'framework-specific';
export interface BestPractice {
    id: string;
    title: string;
    description: string;
    rationale: string;
    examples: CodeExample[];
    violations: Violation[];
    category: string;
    severity: 'info' | 'warning' | 'error';
    language: string;
    frameworks: string[];
}
export interface CodeExample {
    good: string;
    bad?: string;
    explanation: string;
}
export interface Violation {
    pattern: RegExp | string;
    message: string;
    fix?: string;
}
export interface AntiPattern {
    id: string;
    name: string;
    description: string;
    why: string;
    consequences: string[];
    detection: DetectionRule;
    solution: string;
    examples: {
        bad: string;
        good: string;
    };
    frequency: number;
    projects: string[];
}
export interface DetectionRule {
    type: 'regex' | 'ast' | 'semantic';
    pattern: string;
    confidence: number;
}
export interface Solution {
    id: string;
    problem: string;
    solution: string;
    code: string;
    language: string;
    tags: string[];
    upvotes: number;
    source: 'learned' | 'copilot' | 'manual';
    projects: string[];
}
export interface SimilarProject {
    path: string;
    name: string;
    similarity: number;
    sharedPatterns: string[];
    techStack: string[];
}
export interface TransferResult {
    patternsTransferred: number;
    practicesTransferred: number;
    antiPatternsDetected: number;
    suggestions: string[];
}
export interface PatternSuggestion {
    pattern: Pattern;
    relevance: number;
    reason: string;
    application: string;
}
export declare class CrossProjectKnowledgeBase {
    private dataPath;
    private patterns;
    private bestPractices;
    private antiPatterns;
    private solutions;
    private projectProfiles;
    constructor(basePath?: string);
    private ensureDataDir;
    /**
     * Load all knowledge
     */
    private load;
    private loadPatterns;
    private loadBestPractices;
    private loadAntiPatterns;
    private loadSolutions;
    /**
     * Builtin patterns (hardcoded best practices)
     */
    private loadBuiltinPatterns;
    /**
     * Save all knowledge
     */
    private save;
    private savePatterns;
    private saveSolutions;
    /**
     * Store a new pattern
     */
    storePattern(pattern: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>): Pattern;
    /**
     * Get most used patterns
     */
    getMostUsedPatterns(category?: PatternCategory, limit?: number): Pattern[];
    /**
     * Search patterns
     */
    searchPatterns(query: string): Pattern[];
    /**
     * Get patterns for language
     */
    getPatternsForLanguage(language: string): Pattern[];
    /**
     * Suggest patterns based on context
     */
    suggestPatterns(context: CodeContext): PatternSuggestion[];
    private calculatePatternRelevance;
    private explainRelevance;
    private suggestApplication;
    /**
     * Get best practices for context
     */
    getBestPractices(language: string, framework?: string): BestPractice[];
    /**
     * Check code against best practices
     */
    checkBestPractices(code: string, language: string): Array<{
        practice: BestPractice;
        violated: boolean;
        message?: string;
    }>;
    /**
     * Detect anti-patterns in code
     */
    detectAntiPatterns(code: string): Array<{
        antiPattern: AntiPattern;
        matches: RegExpMatchArray[];
        severity: 'low' | 'medium' | 'high';
    }>;
    /**
     * Store a solution
     */
    storeSolution(solution: Omit<Solution, 'id'>): Solution;
    /**
     * Search solutions
     */
    searchSolutions(problem: string): Solution[];
    /**
     * Extract patterns from project
     */
    extractPatterns(projectPath: string): Pattern[];
    /**
     * Find similar projects
     */
    findSimilarProjects(projectPath: string): SimilarProject[];
    /**
     * Transfer knowledge from one project to another
     */
    transferKnowledge(fromPath: string, toPath: string): TransferResult;
    private getProjectProfile;
    private detectTechStack;
    private calculateProjectSimilarity;
    private findSharedPatterns;
    private isPatternApplicable;
    /**
     * Get statistics
     */
    getStats(): {
        patterns: number;
        bestPractices: number;
        antiPatterns: number;
        solutions: number;
        projects: number;
    };
}
interface CodeContext {
    code: string;
    language: string;
    keywords: string[];
    file?: string;
}
export declare function getCrossProjectKB(basePath?: string): CrossProjectKnowledgeBase;
export default CrossProjectKnowledgeBase;
