/**
 * FuncLib v4 - Bug Predictor
 * Potansiyel bug'ları tespit et, risk skorları hesapla
 */
import { Symbol } from '../types';
export interface BugPrediction {
    symbol: string;
    file: string;
    line?: number;
    risk: 'critical' | 'high' | 'medium' | 'low';
    score: number;
    type: BugType;
    reason: string;
    suggestion: string;
    confidence: number;
    relatedBugs?: string[];
}
export type BugType = 'null_reference' | 'type_mismatch' | 'race_condition' | 'memory_leak' | 'unhandled_error' | 'infinite_loop' | 'security_vulnerability' | 'performance_issue' | 'logic_error' | 'dead_code' | 'deprecated_usage' | 'breaking_change';
export interface HotspotInfo {
    file: string;
    changeFrequency: number;
    bugFrequency: number;
    complexity: number;
    lastChange: Date;
    authors: string[];
    riskScore: number;
}
export interface RiskAssessment {
    overall: number;
    factors: Array<{
        name: string;
        weight: number;
        score: number;
    }>;
    mitigations: string[];
}
interface CodePattern {
    pattern: RegExp;
    type: BugType;
    risk: BugPrediction['risk'];
    reason: string;
    suggestion: string;
}
export declare class BugPredictor {
    private projectPath;
    private riskyPatterns;
    constructor(projectPath?: string);
    predictBugs(symbol: Symbol, code?: string): BugPrediction[];
    private riskToScore;
    calculateRiskScore(symbol: Symbol, code?: string): RiskAssessment;
    findHotspots(files: string[], limit?: number): HotspotInfo[];
    addPattern(pattern: CodePattern): void;
    listPatterns(): Array<{
        type: BugType;
        risk: string;
        reason: string;
    }>;
}
export declare function getBugPredictor(projectPath?: string): BugPredictor;
export default BugPredictor;
