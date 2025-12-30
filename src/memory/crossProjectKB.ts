/**
 * FuncLib v4 - Cross-Project Knowledge Base
 * Pattern repository, best practices, anti-patterns
 */

import * as fs from 'fs';
import * as path from 'path';

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

export type PatternCategory = 
  | 'design-pattern'
  | 'code-pattern'
  | 'api-pattern'
  | 'error-handling'
  | 'async-pattern'
  | 'state-management'
  | 'testing-pattern'
  | 'security-pattern'
  | 'performance-pattern'
  | 'framework-specific';

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

export class CrossProjectKnowledgeBase {
  private dataPath: string;
  private patterns: Map<string, Pattern> = new Map();
  private bestPractices: Map<string, BestPractice> = new Map();
  private antiPatterns: Map<string, AntiPattern> = new Map();
  private solutions: Map<string, Solution> = new Map();
  private projectProfiles: Map<string, ProjectProfile> = new Map();

  constructor(basePath?: string) {
    this.dataPath = basePath || path.join(
      process.env.HOME || process.env.USERPROFILE || '.',
      '.funclib',
      'knowledge-base'
    );
    this.ensureDataDir();
    this.load();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Load all knowledge
   */
  private load(): void {
    this.loadPatterns();
    this.loadBestPractices();
    this.loadAntiPatterns();
    this.loadSolutions();
    this.loadBuiltinPatterns();
  }

  private loadPatterns(): void {
    try {
      const filePath = path.join(this.dataPath, 'patterns.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const p of data.patterns || []) {
          this.patterns.set(p.id, {
            ...p,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  private loadBestPractices(): void {
    try {
      const filePath = path.join(this.dataPath, 'best-practices.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const bp of data.practices || []) {
          this.bestPractices.set(bp.id, bp);
        }
      }
    } catch {
      // Ignore
    }
  }

  private loadAntiPatterns(): void {
    try {
      const filePath = path.join(this.dataPath, 'anti-patterns.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const ap of data.antiPatterns || []) {
          this.antiPatterns.set(ap.id, ap);
        }
      }
    } catch {
      // Ignore
    }
  }

  private loadSolutions(): void {
    try {
      const filePath = path.join(this.dataPath, 'solutions.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const s of data.solutions || []) {
          this.solutions.set(s.id, s);
        }
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Builtin patterns (hardcoded best practices)
   */
  private loadBuiltinPatterns(): void {
    const builtins: Pattern[] = [
      {
        id: 'vue-composition-ref',
        name: 'Vue Composition API - Reactive Ref',
        category: 'framework-specific',
        language: 'typescript',
        description: 'Using ref() for reactive primitive values',
        code: 'const count = ref(0);',
        usage: 'Use ref() for primitive values that need reactivity',
        frequency: 100,
        confidence: 0.95,
        projects: [],
        tags: ['vue', 'composition-api', 'reactivity'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'async-await-error-handling',
        name: 'Async/Await Error Handling',
        category: 'error-handling',
        language: 'typescript',
        description: 'Proper error handling with async/await',
        code: `try {
  const result = await fetchData();
} catch (error) {
  console.error('Failed to fetch:', error);
  throw error;
}`,
        usage: 'Always wrap async operations in try-catch',
        frequency: 100,
        confidence: 0.9,
        projects: [],
        tags: ['async', 'error-handling', 'best-practice'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'optional-chaining',
        name: 'Optional Chaining for Null Safety',
        category: 'code-pattern',
        language: 'typescript',
        description: 'Use optional chaining to prevent null reference errors',
        code: 'const name = user?.profile?.name ?? "Unknown";',
        usage: 'Use ?. when accessing nested properties that might be null',
        frequency: 100,
        confidence: 0.95,
        projects: [],
        tags: ['null-safety', 'typescript', 'best-practice'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const p of builtins) {
      if (!this.patterns.has(p.id)) {
        this.patterns.set(p.id, p);
      }
    }

    // Builtin anti-patterns
    const antiPatternBuiltins: AntiPattern[] = [
      {
        id: 'any-type-abuse',
        name: 'TypeScript Any Type Abuse',
        description: 'Overusing "any" type defeats the purpose of TypeScript',
        why: 'Loses type safety, makes refactoring harder, hides bugs',
        consequences: ['Runtime type errors', 'Poor IDE support', 'Maintenance nightmare'],
        detection: { type: 'regex', pattern: ':\\s*any\\b', confidence: 0.8 },
        solution: 'Use specific types, generics, or "unknown" when type is truly unknown',
        examples: {
          bad: 'function process(data: any) { return data.value; }',
          good: 'function process<T extends { value: string }>(data: T) { return data.value; }',
        },
        frequency: 0,
        projects: [],
      },
      {
        id: 'callback-hell',
        name: 'Callback Hell',
        description: 'Deeply nested callbacks making code hard to read',
        why: 'Reduces readability, error handling is difficult',
        consequences: ['Hard to maintain', 'Error handling issues', 'Debugging nightmare'],
        detection: { type: 'ast', pattern: 'nested-callbacks > 3', confidence: 0.9 },
        solution: 'Use async/await or Promise chains',
        examples: {
          bad: 'getData((a) => { process(a, (b) => { save(b, (c) => { done(c); }); }); });',
          good: 'const a = await getData();\nconst b = await process(a);\nconst c = await save(b);\ndone(c);',
        },
        frequency: 0,
        projects: [],
      },
      {
        id: 'console-log-production',
        name: 'Console.log in Production',
        description: 'Leaving console.log statements in production code',
        why: 'Performance impact, information leakage, unprofessional',
        consequences: ['Performance degradation', 'Security risk', 'Cluttered console'],
        detection: { type: 'regex', pattern: 'console\\.log\\(', confidence: 0.95 },
        solution: 'Use proper logging library with log levels',
        examples: {
          bad: 'console.log("User data:", userData);',
          good: 'logger.debug("User data:", userData);',
        },
        frequency: 0,
        projects: [],
      },
    ];

    for (const ap of antiPatternBuiltins) {
      if (!this.antiPatterns.has(ap.id)) {
        this.antiPatterns.set(ap.id, ap);
      }
    }
  }

  /**
   * Save all knowledge
   */
  private save(): void {
    this.savePatterns();
    this.saveSolutions();
  }

  private savePatterns(): void {
    try {
      const filePath = path.join(this.dataPath, 'patterns.json');
      fs.writeFileSync(filePath, JSON.stringify({
        version: 1,
        patterns: Array.from(this.patterns.values()),
      }, null, 2));
    } catch {
      // Ignore
    }
  }

  private saveSolutions(): void {
    try {
      const filePath = path.join(this.dataPath, 'solutions.json');
      fs.writeFileSync(filePath, JSON.stringify({
        version: 1,
        solutions: Array.from(this.solutions.values()),
      }, null, 2));
    } catch {
      // Ignore
    }
  }

  // ================== Pattern Repository ==================

  /**
   * Store a new pattern
   */
  storePattern(pattern: Omit<Pattern, 'id' | 'createdAt' | 'updatedAt'>): Pattern {
    const id = `pat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const fullPattern: Pattern = {
      ...pattern,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.patterns.set(id, fullPattern);
    this.save();
    return fullPattern;
  }

  /**
   * Get most used patterns
   */
  getMostUsedPatterns(category?: PatternCategory, limit: number = 10): Pattern[] {
    let patterns = Array.from(this.patterns.values());
    
    if (category) {
      patterns = patterns.filter(p => p.category === category);
    }

    return patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  /**
   * Search patterns
   */
  searchPatterns(query: string): Pattern[] {
    const lower = query.toLowerCase();
    return Array.from(this.patterns.values())
      .filter(p => 
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower) ||
        p.tags.some(t => t.toLowerCase().includes(lower))
      )
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get patterns for language
   */
  getPatternsForLanguage(language: string): Pattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.language === language || p.language === 'any')
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Suggest patterns based on context
   */
  suggestPatterns(context: CodeContext): PatternSuggestion[] {
    const suggestions: PatternSuggestion[] = [];
    const patterns = this.getPatternsForLanguage(context.language);

    for (const pattern of patterns) {
      const relevance = this.calculatePatternRelevance(pattern, context);
      if (relevance > 0.3) {
        suggestions.push({
          pattern,
          relevance,
          reason: this.explainRelevance(pattern, context),
          application: this.suggestApplication(pattern, context),
        });
      }
    }

    return suggestions
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
  }

  private calculatePatternRelevance(pattern: Pattern, context: CodeContext): number {
    let relevance = 0;

    // Tag match
    for (const tag of pattern.tags) {
      if (context.keywords.some(k => k.includes(tag) || tag.includes(k))) {
        relevance += 0.2;
      }
    }

    // Category match based on code content
    if (context.code.includes('async') && pattern.category === 'async-pattern') {
      relevance += 0.3;
    }
    if (context.code.includes('try') && pattern.category === 'error-handling') {
      relevance += 0.3;
    }

    // Frequency boost
    relevance += Math.min(0.2, pattern.frequency / 100 * 0.2);

    // Confidence boost
    relevance += pattern.confidence * 0.1;

    return Math.min(1, relevance);
  }

  private explainRelevance(pattern: Pattern, context: CodeContext): string {
    const reasons: string[] = [];

    if (context.code.includes('async')) {
      reasons.push('async code detected');
    }
    if (context.code.includes('try')) {
      reasons.push('error handling context');
    }
    if (pattern.frequency > 50) {
      reasons.push('frequently used pattern');
    }

    return reasons.length > 0 
      ? `Relevant because: ${reasons.join(', ')}`
      : 'May be applicable to current context';
  }

  private suggestApplication(pattern: Pattern, context: CodeContext): string {
    return `Consider using ${pattern.name}: ${pattern.usage}`;
  }

  // ================== Best Practices ==================

  /**
   * Get best practices for context
   */
  getBestPractices(language: string, framework?: string): BestPractice[] {
    return Array.from(this.bestPractices.values())
      .filter(bp => 
        bp.language === language &&
        (!framework || bp.frameworks.includes(framework))
      );
  }

  /**
   * Check code against best practices
   */
  checkBestPractices(code: string, language: string): Array<{
    practice: BestPractice;
    violated: boolean;
    message?: string;
  }> {
    const results: Array<{ practice: BestPractice; violated: boolean; message?: string }> = [];
    const practices = this.getBestPractices(language);

    for (const practice of practices) {
      for (const violation of practice.violations) {
        const pattern = typeof violation.pattern === 'string'
          ? new RegExp(violation.pattern)
          : violation.pattern;

        if (pattern.test(code)) {
          results.push({
            practice,
            violated: true,
            message: violation.message,
          });
          break;
        }
      }
    }

    return results;
  }

  // ================== Anti-Patterns ==================

  /**
   * Detect anti-patterns in code
   */
  detectAntiPatterns(code: string): Array<{
    antiPattern: AntiPattern;
    matches: RegExpMatchArray[];
    severity: 'low' | 'medium' | 'high';
  }> {
    const detected: Array<{
      antiPattern: AntiPattern;
      matches: RegExpMatchArray[];
      severity: 'low' | 'medium' | 'high';
    }> = [];

    for (const ap of this.antiPatterns.values()) {
      if (ap.detection.type === 'regex') {
        const pattern = new RegExp(ap.detection.pattern, 'g');
        const matches = Array.from(code.matchAll(pattern));
        
        if (matches.length > 0) {
          const severity = matches.length > 5 ? 'high' : matches.length > 2 ? 'medium' : 'low';
          detected.push({ antiPattern: ap, matches, severity });
        }
      }
    }

    return detected;
  }

  // ================== Solutions ==================

  /**
   * Store a solution
   */
  storeSolution(solution: Omit<Solution, 'id'>): Solution {
    const id = `sol_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const fullSolution: Solution = { ...solution, id };
    
    this.solutions.set(id, fullSolution);
    this.save();
    return fullSolution;
  }

  /**
   * Search solutions
   */
  searchSolutions(problem: string): Solution[] {
    const lower = problem.toLowerCase();
    return Array.from(this.solutions.values())
      .filter(s =>
        s.problem.toLowerCase().includes(lower) ||
        s.tags.some(t => t.toLowerCase().includes(lower))
      )
      .sort((a, b) => b.upvotes - a.upvotes);
  }

  // ================== Cross-Project ==================

  /**
   * Extract patterns from project
   */
  extractPatterns(projectPath: string): Pattern[] {
    // Bu fonksiyon proje kodunu analiz edip pattern çıkaracak
    // Şimdilik basit implementasyon
    const extracted: Pattern[] = [];
    
    // TODO: Implement pattern extraction from project code
    
    return extracted;
  }

  /**
   * Find similar projects
   */
  findSimilarProjects(projectPath: string): SimilarProject[] {
    const currentProfile = this.getProjectProfile(projectPath);
    const similar: SimilarProject[] = [];

    for (const [path, profile] of this.projectProfiles) {
      if (path === projectPath) continue;

      const similarity = this.calculateProjectSimilarity(currentProfile, profile);
      if (similarity > 0.3) {
        similar.push({
          path,
          name: profile.name,
          similarity,
          sharedPatterns: this.findSharedPatterns(currentProfile, profile),
          techStack: profile.techStack,
        });
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Transfer knowledge from one project to another
   */
  transferKnowledge(fromPath: string, toPath: string): TransferResult {
    const fromProfile = this.getProjectProfile(fromPath);
    const toProfile = this.getProjectProfile(toPath);

    // Find applicable patterns
    const applicablePatterns = Array.from(this.patterns.values())
      .filter(p => 
        p.projects.includes(fromPath) &&
        this.isPatternApplicable(p, toProfile)
      );

    // Detect anti-patterns in target project
    // TODO: Implement anti-pattern detection

    return {
      patternsTransferred: applicablePatterns.length,
      practicesTransferred: 0,
      antiPatternsDetected: 0,
      suggestions: applicablePatterns.map(p => 
        `Consider using "${p.name}" pattern from ${fromPath}`
      ),
    };
  }

  private getProjectProfile(projectPath: string): ProjectProfile {
    if (this.projectProfiles.has(projectPath)) {
      return this.projectProfiles.get(projectPath)!;
    }

    // Create basic profile
    const profile: ProjectProfile = {
      path: projectPath,
      name: path.basename(projectPath),
      techStack: this.detectTechStack(projectPath),
      patterns: [],
      analyzedAt: new Date(),
    };

    this.projectProfiles.set(projectPath, profile);
    return profile;
  }

  private detectTechStack(projectPath: string): string[] {
    const stack: string[] = [];
    
    try {
      const pkgPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.vue) stack.push('vue');
        if (deps.react) stack.push('react');
        if (deps.typescript) stack.push('typescript');
        if (deps.express) stack.push('express');
        if (deps.prisma) stack.push('prisma');
      }
    } catch {
      // Ignore
    }

    return stack;
  }

  private calculateProjectSimilarity(a: ProjectProfile, b: ProjectProfile): number {
    // Tech stack similarity
    const aStack = new Set(a.techStack);
    const bStack = new Set(b.techStack);
    
    let intersection = 0;
    for (const tech of aStack) {
      if (bStack.has(tech)) intersection++;
    }

    return (2 * intersection) / (aStack.size + bStack.size);
  }

  private findSharedPatterns(a: ProjectProfile, b: ProjectProfile): string[] {
    return a.patterns.filter(p => b.patterns.includes(p));
  }

  private isPatternApplicable(pattern: Pattern, profile: ProjectProfile): boolean {
    // Check if pattern's language/framework matches
    return profile.techStack.some(t => 
      pattern.tags.includes(t) || pattern.language === t
    );
  }

  /**
   * Get statistics
   */
  getStats(): {
    patterns: number;
    bestPractices: number;
    antiPatterns: number;
    solutions: number;
    projects: number;
  } {
    return {
      patterns: this.patterns.size,
      bestPractices: this.bestPractices.size,
      antiPatterns: this.antiPatterns.size,
      solutions: this.solutions.size,
      projects: this.projectProfiles.size,
    };
  }
}

interface ProjectProfile {
  path: string;
  name: string;
  techStack: string[];
  patterns: string[];
  analyzedAt: Date;
}

interface CodeContext {
  code: string;
  language: string;
  keywords: string[];
  file?: string;
}

// Singleton
let knowledgeBase: CrossProjectKnowledgeBase | null = null;

export function getCrossProjectKB(basePath?: string): CrossProjectKnowledgeBase {
  if (!knowledgeBase) {
    knowledgeBase = new CrossProjectKnowledgeBase(basePath);
  }
  return knowledgeBase;
}

export default CrossProjectKnowledgeBase;
