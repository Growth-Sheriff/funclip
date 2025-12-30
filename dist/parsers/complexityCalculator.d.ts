/**
 * FuncLib v4 - Complexity Metrics Calculator
 * Cyclomatic complexity, cognitive complexity ve diğer metrikleri hesaplar
 */
export interface ComplexityMetrics {
    cyclomatic: number;
    cognitive: number;
    halstead: HalsteadMetrics;
    linesOfCode: number;
    linesOfComments: number;
    blankLines: number;
    maintainability: number;
}
export interface HalsteadMetrics {
    vocabulary: number;
    length: number;
    volume: number;
    difficulty: number;
    effort: number;
    time: number;
    bugs: number;
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
export declare class ComplexityCalculator {
    /**
     * Kod parçası için complexity hesapla
     */
    calculate(code: string): ComplexityMetrics;
    /**
     * Dosyadaki tüm fonksiyonların metriklerini hesapla
     */
    calculateFile(code: string, functions: Array<{
        name: string;
        start: number;
        end: number;
    }>): FileMetrics;
    /**
     * McCabe Cyclomatic Complexity
     * Formula: E - N + 2P (edges - nodes + 2*connected_components)
     * Simplified: 1 + number of decision points
     */
    private calculateCyclomatic;
    /**
     * Cognitive Complexity (SonarSource algorithm)
     * Daha okunabilirlik odaklı complexity ölçümü
     */
    private calculateCognitive;
    /**
     * Halstead Metrics
     */
    private calculateHalstead;
    /**
     * Maintainability Index (0-100)
     * Formula: 171 - 5.2*ln(V) - 0.23*G - 16.2*ln(L)
     */
    private calculateMaintainability;
    /**
     * Satır sayıları
     */
    private countLOC;
    /**
     * String ve comment'leri kaldır
     */
    private removeStringsAndComments;
    /**
     * Basit tokenizer
     */
    private tokenize;
    private isKeyword;
    private isOperand;
}
export declare function getComplexityCalculator(): ComplexityCalculator;
export default ComplexityCalculator;
