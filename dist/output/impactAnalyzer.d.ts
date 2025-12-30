/**
 * FuncLib v4 - Impact Analyzer
 * Değişikliklerin etkisini analiz et
 */
import { Symbol } from '../types';
export interface ImpactAnalysis {
    changedSymbol: string;
    directImpact: DirectImpact[];
    transitiveImpact: TransitiveImpact[];
    testImpact: TestImpact[];
    summary: {
        totalAffected: number;
        criticalFiles: number;
        testsAffected: number;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
    };
}
export interface DirectImpact {
    symbol: string;
    file: string;
    relation: string;
    reason: string;
}
export interface TransitiveImpact {
    symbol: string;
    file: string;
    path: string[];
    distance: number;
}
export interface TestImpact {
    testFile: string;
    testName: string;
    reason: string;
    confidence: number;
}
export interface WhatIfScenario {
    change: string;
    possibleImpact: ImpactAnalysis;
    recommendations: string[];
    riskScore: number;
}
export declare class ImpactAnalyzer {
    private projectPath;
    constructor(projectPath?: string);
    analyze(symbol: Symbol | string): ImpactAnalysis;
    whatIf(symbolName: string, changeDescription: string): WhatIfScenario;
    private calculateRiskScore;
    analyzeChangeSet(symbols: string[]): ImpactAnalysis[];
    getImpactGraph(symbol: string, depth?: number): Map<string, string[]>;
}
export declare function getImpactAnalyzer(projectPath?: string): ImpactAnalyzer;
export default ImpactAnalyzer;
