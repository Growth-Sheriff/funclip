/**
 * FuncLib v4 - Complexity Metrics Calculator
 * Cyclomatic complexity, cognitive complexity ve diğer metrikleri hesaplar
 */

export interface ComplexityMetrics {
  cyclomatic: number;        // McCabe cyclomatic complexity
  cognitive: number;         // Cognitive complexity (SonarSource)
  halstead: HalsteadMetrics; // Halstead metrics
  linesOfCode: number;       // LOC
  linesOfComments: number;
  blankLines: number;
  maintainability: number;   // 0-100 maintainability index
}

export interface HalsteadMetrics {
  vocabulary: number;        // n = n1 + n2
  length: number;            // N = N1 + N2
  volume: number;            // V = N * log2(n)
  difficulty: number;        // D = (n1/2) * (N2/n2)
  effort: number;            // E = D * V
  time: number;              // T = E / 18 (seconds)
  bugs: number;              // B = V / 3000
}

export interface FileMetrics {
  file: string;
  totalComplexity: number;
  averageComplexity: number;
  maxComplexity: number;
  functionCount: number;
  functions: FunctionMetrics[];
}

export interface FunctionMetrics {
  name: string;
  line: number;
  complexity: ComplexityMetrics;
}

// Complexity hesaplama için keyword'ler
const CONTROL_FLOW_KEYWORDS = [
  'if', 'else', 'elseif', 'elif',
  'for', 'while', 'do',
  'switch', 'case',
  'catch', 'try',
  'throw', 'throws',
  '?', '&&', '||', '??',
];

const OPERATORS = new Set([
  '+', '-', '*', '/', '%', '**',
  '++', '--',
  '==', '===', '!=', '!==', '<', '>', '<=', '>=',
  '&&', '||', '!', '??',
  '&', '|', '^', '~', '<<', '>>', '>>>',
  '=', '+=', '-=', '*=', '/=', '%=',
  '?', ':',
  '.', '?.', '?..',
  '=>',
]);

export class ComplexityCalculator {
  /**
   * Kod parçası için complexity hesapla
   */
  calculate(code: string): ComplexityMetrics {
    const lines = code.split('\n');
    const loc = this.countLOC(lines);
    const cyclomatic = this.calculateCyclomatic(code);
    const cognitive = this.calculateCognitive(code);
    const halstead = this.calculateHalstead(code);
    
    const maintainability = this.calculateMaintainability(
      halstead.volume,
      cyclomatic,
      loc.code
    );

    return {
      cyclomatic,
      cognitive,
      halstead,
      linesOfCode: loc.code,
      linesOfComments: loc.comments,
      blankLines: loc.blank,
      maintainability,
    };
  }

  /**
   * Dosyadaki tüm fonksiyonların metriklerini hesapla
   */
  calculateFile(code: string, functions: Array<{ name: string; start: number; end: number }>): FileMetrics {
    const lines = code.split('\n');
    const functionMetrics: FunctionMetrics[] = [];
    
    for (const fn of functions) {
      const fnCode = lines.slice(fn.start - 1, fn.end).join('\n');
      const metrics = this.calculate(fnCode);
      
      functionMetrics.push({
        name: fn.name,
        line: fn.start,
        complexity: metrics,
      });
    }

    const complexities = functionMetrics.map(f => f.complexity.cyclomatic);
    
    return {
      file: '',
      totalComplexity: complexities.reduce((a, b) => a + b, 0),
      averageComplexity: complexities.length > 0 
        ? complexities.reduce((a, b) => a + b, 0) / complexities.length 
        : 0,
      maxComplexity: Math.max(0, ...complexities),
      functionCount: functions.length,
      functions: functionMetrics,
    };
  }

  /**
   * McCabe Cyclomatic Complexity
   * Formula: E - N + 2P (edges - nodes + 2*connected_components)
   * Simplified: 1 + number of decision points
   */
  private calculateCyclomatic(code: string): number {
    let complexity = 1; // Base complexity

    // Remove strings and comments
    const cleaned = this.removeStringsAndComments(code);

    // Count decision points
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+[^:]+:/g,
      /\bcatch\s*\(/g,
      /\?\s*[^:]+\s*:/g,  // Ternary
      /\&\&/g,
      /\|\|/g,
      /\?\?/g,
    ];

    for (const pattern of patterns) {
      const matches = cleaned.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Cognitive Complexity (SonarSource algorithm)
   * Daha okunabilirlik odaklı complexity ölçümü
   */
  private calculateCognitive(code: string): number {
    let complexity = 0;
    let nestingLevel = 0;
    
    const cleaned = this.removeStringsAndComments(code);
    const tokens = this.tokenize(cleaned);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const prev = tokens[i - 1];
      const next = tokens[i + 1];

      // Nesting artışı
      if (token === '{') {
        if (['if', 'for', 'while', 'switch', 'catch'].includes(prev || '')) {
          nestingLevel++;
        }
      } else if (token === '}') {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }

      // Structural complexity
      switch (token) {
        case 'if':
          // "else if" ek maliyet yok
          if (prev !== 'else') {
            complexity += 1 + nestingLevel;
          }
          break;

        case 'else':
          complexity += 1;
          break;

        case 'for':
        case 'while':
        case 'do':
          complexity += 1 + nestingLevel;
          break;

        case 'catch':
          complexity += 1 + nestingLevel;
          break;

        case 'switch':
          complexity += 1 + nestingLevel;
          break;

        case '&&':
        case '||':
        case '??':
          // Logical operators (sadece art arda değilse)
          if (prev !== '&&' && prev !== '||' && prev !== '??') {
            complexity += 1;
          }
          break;

        case '?':
          // Ternary operator
          if (next !== '.') { // Optional chaining değilse
            complexity += 1 + nestingLevel;
          }
          break;

        case 'break':
        case 'continue':
          // Label'lı ise ek maliyet
          if (next && /^[a-zA-Z_]/.test(next)) {
            complexity += 1;
          }
          break;

        case 'goto':
          complexity += 1;
          break;
      }
    }

    return complexity;
  }

  /**
   * Halstead Metrics
   */
  private calculateHalstead(code: string): HalsteadMetrics {
    const cleaned = this.removeStringsAndComments(code);
    const tokens = this.tokenize(cleaned);

    const operators = new Map<string, number>();
    const operands = new Map<string, number>();

    for (const token of tokens) {
      if (OPERATORS.has(token) || this.isKeyword(token)) {
        operators.set(token, (operators.get(token) || 0) + 1);
      } else if (this.isOperand(token)) {
        operands.set(token, (operands.get(token) || 0) + 1);
      }
    }

    const n1 = operators.size;  // Unique operators
    const n2 = operands.size;   // Unique operands
    const N1 = Array.from(operators.values()).reduce((a, b) => a + b, 0);
    const N2 = Array.from(operands.values()).reduce((a, b) => a + b, 0);

    const vocabulary = n1 + n2;
    const length = N1 + N2;
    const volume = length > 0 && vocabulary > 0 
      ? length * Math.log2(vocabulary) 
      : 0;
    const difficulty = n2 > 0 
      ? (n1 / 2) * (N2 / n2) 
      : 0;
    const effort = difficulty * volume;
    const time = effort / 18;
    const bugs = volume / 3000;

    return {
      vocabulary,
      length,
      volume,
      difficulty,
      effort,
      time,
      bugs,
    };
  }

  /**
   * Maintainability Index (0-100)
   * Formula: 171 - 5.2*ln(V) - 0.23*G - 16.2*ln(L)
   */
  private calculateMaintainability(volume: number, cyclomatic: number, loc: number): number {
    if (volume === 0 || loc === 0) return 100;

    const mi = 171 
      - 5.2 * Math.log(volume) 
      - 0.23 * cyclomatic 
      - 16.2 * Math.log(loc);

    // Normalize to 0-100
    return Math.max(0, Math.min(100, mi * 100 / 171));
  }

  /**
   * Satır sayıları
   */
  private countLOC(lines: string[]): { code: number; comments: number; blank: number } {
    let code = 0;
    let comments = 0;
    let blank = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '') {
        blank++;
        continue;
      }

      if (inBlockComment) {
        comments++;
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
        continue;
      }

      if (trimmed.startsWith('//')) {
        comments++;
      } else if (trimmed.startsWith('/*')) {
        comments++;
        if (!trimmed.includes('*/')) {
          inBlockComment = true;
        }
      } else {
        code++;
      }
    }

    return { code, comments, blank };
  }

  /**
   * String ve comment'leri kaldır
   */
  private removeStringsAndComments(code: string): string {
    return code
      // Block comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Line comments
      .replace(/\/\/.*/g, '')
      // Template literals
      .replace(/`[^`]*`/g, '""')
      // Double quoted strings
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      // Single quoted strings
      .replace(/'(?:[^'\\]|\\.)*'/g, '""');
  }

  /**
   * Basit tokenizer
   */
  private tokenize(code: string): string[] {
    const tokens: string[] = [];
    const regex = /[a-zA-Z_$][a-zA-Z0-9_$]*|\d+\.?\d*|[+\-*/%=<>!&|^~?:.]+|[{}()\[\];,]/g;
    
    let match;
    while ((match = regex.exec(code)) !== null) {
      tokens.push(match[0]);
    }

    return tokens;
  }

  private isKeyword(token: string): boolean {
    const keywords = new Set([
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'try', 'catch', 'finally', 'throw', 'return', 'break', 'continue',
      'function', 'class', 'const', 'let', 'var', 'new', 'delete',
      'typeof', 'instanceof', 'in', 'of', 'async', 'await', 'yield',
      'import', 'export', 'from', 'as', 'extends', 'implements',
    ]);
    return keywords.has(token);
  }

  private isOperand(token: string): boolean {
    // İsim veya sayı
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(token) || /^\d/.test(token);
  }
}

// Singleton
let calculator: ComplexityCalculator | null = null;

export function getComplexityCalculator(): ComplexityCalculator {
  if (!calculator) {
    calculator = new ComplexityCalculator();
  }
  return calculator;
}

export default ComplexityCalculator;
