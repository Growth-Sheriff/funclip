/**
 * FuncLib v4 - Mesh Engine
 * Birden fazla model çıktısını birleştir, consensus oluştur
 */
export interface ModelOutput {
    model: string;
    response: string;
    confidence: number;
    latency: number;
    tokens: {
        prompt: number;
        completion: number;
    };
    metadata?: Record<string, any>;
}
export interface Claim {
    id: string;
    text: string;
    source: string;
    confidence: number;
    type: 'fact' | 'opinion' | 'suggestion' | 'warning';
    entities: string[];
}
export interface Agreement {
    claims: Claim[];
    confidence: number;
    sources: string[];
}
export interface Conflict {
    claims: Claim[];
    resolved: boolean;
    winner?: Claim;
    resolution?: string;
}
export interface MeshedOutput {
    synthesized: string;
    confidence: number;
    agreements: Agreement[];
    conflicts: Conflict[];
    sources: string[];
    reasoning: string;
}
export interface Knowledge {
    facts: string[];
    relationships: Array<{
        from: string;
        to: string;
        type: string;
    }>;
    confidence: number;
    source: string;
}
export interface UnifiedKnowledge {
    facts: string[];
    relationships: Array<{
        from: string;
        to: string;
        type: string;
        sources: string[];
    }>;
    conflicts: Array<{
        fact: string;
        sources: string[];
        resolution?: string;
    }>;
    confidence: number;
}
export interface EnrichedKnowledge extends UnifiedKnowledge {
    crossProjectInsights: string[];
    patterns: string[];
    suggestions: string[];
}
export declare class MeshEngine {
    private claimIdCounter;
    /**
     * Birden fazla model çıktısını birleştir
     */
    meshModelOutputs(outputs: ModelOutput[]): MeshedOutput;
    /**
     * Model çıktısından claim'leri çıkar
     */
    private extractClaims;
    /**
     * Cümlelere ayır
     */
    private splitIntoSentences;
    /**
     * Claim tipini belirle
     */
    private classifyClaimType;
    /**
     * Entity'leri çıkar
     */
    private extractEntities;
    /**
     * Cümle güven skoru
     */
    private sentenceConfidence;
    /**
     * Anlaşmaları bul
     */
    private findAgreements;
    /**
     * İki claim arasındaki benzerliği hesapla
     */
    private calculateSimilarity;
    /**
     * Agreement güvenini hesapla
     */
    private calculateAgreementConfidence;
    /**
     * Conflict'leri bul ve çöz
     */
    private findAndResolveConflicts;
    /**
     * İki claim çelişiyor mu?
     */
    private areContradictory;
    /**
     * Conflict'i çöz
     */
    private resolveConflict;
    /**
     * Final sentezi oluştur
     */
    private synthesize;
    /**
     * Text overlap
     */
    private textOverlap;
    /**
     * Genel güven hesapla
     */
    private calculateOverallConfidence;
    /**
     * Reasoning açıklaması
     */
    private explainReasoning;
    /**
     * Farklı bilgi kaynaklarını birleştir
     */
    meshKnowledge(codeKnowledge: Knowledge, graphKnowledge: Knowledge, historyKnowledge: Knowledge, copilotKnowledge: Knowledge): UnifiedKnowledge;
    /**
     * Cross-project knowledge ile zenginleştir
     */
    meshCrossProject(currentProject: UnifiedKnowledge, similarProjects: UnifiedKnowledge[]): EnrichedKnowledge;
}
export declare function getMeshEngine(): MeshEngine;
export default MeshEngine;
