/**
 * FuncLib v4 - Mesh Engine
 * Birden fazla model çıktısını birleştir, consensus oluştur
 */

export interface ModelOutput {
  model: string;
  response: string;
  confidence: number;
  latency: number;
  tokens: { prompt: number; completion: number };
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
  relationships: Array<{ from: string; to: string; type: string }>;
  confidence: number;
  source: string;
}

export interface UnifiedKnowledge {
  facts: string[];
  relationships: Array<{ from: string; to: string; type: string; sources: string[] }>;
  conflicts: Array<{ fact: string; sources: string[]; resolution?: string }>;
  confidence: number;
}

export interface EnrichedKnowledge extends UnifiedKnowledge {
  crossProjectInsights: string[];
  patterns: string[];
  suggestions: string[];
}

export class MeshEngine {
  private claimIdCounter: number = 0;

  /**
   * Birden fazla model çıktısını birleştir
   */
  meshModelOutputs(outputs: ModelOutput[]): MeshedOutput {
    if (outputs.length === 0) {
      return {
        synthesized: '',
        confidence: 0,
        agreements: [],
        conflicts: [],
        sources: [],
        reasoning: 'No outputs to mesh',
      };
    }

    if (outputs.length === 1) {
      return {
        synthesized: outputs[0].response,
        confidence: outputs[0].confidence,
        agreements: [],
        conflicts: [],
        sources: [outputs[0].model],
        reasoning: 'Single model output, no meshing needed',
      };
    }

    // 1. Her çıktıdan claim'leri çıkar
    const allClaims = outputs.flatMap(o => this.extractClaims(o));

    // 2. Agreement'ları bul
    const agreements = this.findAgreements(allClaims);

    // 3. Conflict'leri bul ve çöz
    const conflicts = this.findAndResolveConflicts(allClaims, outputs);

    // 4. Final sentezi oluştur
    const synthesized = this.synthesize(agreements, conflicts, outputs);

    // 5. Genel güven hesapla
    const confidence = this.calculateOverallConfidence(agreements, conflicts, outputs);

    return {
      synthesized,
      confidence,
      agreements,
      conflicts,
      sources: outputs.map(o => o.model),
      reasoning: this.explainReasoning(agreements, conflicts),
    };
  }

  /**
   * Model çıktısından claim'leri çıkar
   */
  private extractClaims(output: ModelOutput): Claim[] {
    const claims: Claim[] = [];
    const sentences = this.splitIntoSentences(output.response);

    for (const sentence of sentences) {
      const type = this.classifyClaimType(sentence);
      const entities = this.extractEntities(sentence);
      
      claims.push({
        id: `claim_${++this.claimIdCounter}`,
        text: sentence.trim(),
        source: output.model,
        confidence: output.confidence * this.sentenceConfidence(sentence),
        type,
        entities,
      });
    }

    return claims;
  }

  /**
   * Cümlelere ayır
   */
  private splitIntoSentences(text: string): string[] {
    // Basit sentence splitting
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 10);
  }

  /**
   * Claim tipini belirle
   */
  private classifyClaimType(sentence: string): Claim['type'] {
    const lower = sentence.toLowerCase();

    if (/\b(warning|caution|danger|risk|careful)\b/.test(lower)) {
      return 'warning';
    }
    if (/\b(suggest|recommend|should|could|might want to)\b/.test(lower)) {
      return 'suggestion';
    }
    if (/\b(i think|in my opinion|perhaps|maybe)\b/.test(lower)) {
      return 'opinion';
    }
    return 'fact';
  }

  /**
   * Entity'leri çıkar
   */
  private extractEntities(sentence: string): string[] {
    const entities: string[] = [];

    // Backtick içindeki kod/semboller
    const backtickMatches = sentence.matchAll(/`([^`]+)`/g);
    for (const match of backtickMatches) {
      entities.push(match[1]);
    }

    // CamelCase/PascalCase kelimeler
    const camelMatches = sentence.matchAll(/\b([A-Z][a-z]+[A-Z][a-zA-Z]*)\b/g);
    for (const match of camelMatches) {
      entities.push(match[1]);
    }

    // Dosya yolları
    const pathMatches = sentence.matchAll(/\b[\w/\\.-]+\.(ts|js|vue|py|go)\b/g);
    for (const match of pathMatches) {
      entities.push(match[0]);
    }

    return [...new Set(entities)];
  }

  /**
   * Cümle güven skoru
   */
  private sentenceConfidence(sentence: string): number {
    let confidence = 0.7;

    // Kesinlik ifadeleri güveni artırır
    if (/\b(definitely|certainly|always|must|is)\b/i.test(sentence)) {
      confidence += 0.1;
    }

    // Belirsizlik ifadeleri güveni azaltır
    if (/\b(maybe|perhaps|might|could|possibly)\b/i.test(sentence)) {
      confidence -= 0.2;
    }

    // Kod içeren cümleler daha güvenilir
    if (/`[^`]+`/.test(sentence)) {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Anlaşmaları bul
   */
  private findAgreements(claims: Claim[]): Agreement[] {
    const agreements: Agreement[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < claims.length; i++) {
      if (processed.has(claims[i].id)) continue;

      const similar: Claim[] = [claims[i]];
      
      for (let j = i + 1; j < claims.length; j++) {
        if (processed.has(claims[j].id)) continue;
        
        // Farklı kaynaklardan benzer claim'ler
        if (claims[i].source !== claims[j].source) {
          const similarity = this.calculateSimilarity(claims[i], claims[j]);
          if (similarity > 0.6) {
            similar.push(claims[j]);
            processed.add(claims[j].id);
          }
        }
      }

      if (similar.length > 1) {
        processed.add(claims[i].id);
        agreements.push({
          claims: similar,
          confidence: this.calculateAgreementConfidence(similar),
          sources: [...new Set(similar.map(c => c.source))],
        });
      }
    }

    return agreements;
  }

  /**
   * İki claim arasındaki benzerliği hesapla
   */
  private calculateSimilarity(a: Claim, b: Claim): number {
    // Entity overlap
    const aEntities = new Set(a.entities);
    const bEntities = new Set(b.entities);
    
    let entityOverlap = 0;
    for (const e of aEntities) {
      if (bEntities.has(e)) entityOverlap++;
    }
    const entitySim = aEntities.size + bEntities.size > 0
      ? (2 * entityOverlap) / (aEntities.size + bEntities.size)
      : 0;

    // Word overlap
    const aWords = new Set(a.text.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const bWords = new Set(b.text.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    
    let wordOverlap = 0;
    for (const w of aWords) {
      if (bWords.has(w)) wordOverlap++;
    }
    const wordSim = aWords.size + bWords.size > 0
      ? (2 * wordOverlap) / (aWords.size + bWords.size)
      : 0;

    // Aynı tip
    const typeSim = a.type === b.type ? 0.2 : 0;

    return entitySim * 0.4 + wordSim * 0.4 + typeSim;
  }

  /**
   * Agreement güvenini hesapla
   */
  private calculateAgreementConfidence(claims: Claim[]): number {
    // Daha fazla kaynak = daha yüksek güven
    const sourceFactor = Math.min(1, claims.length / 3);
    
    // Ortalama claim güveni
    const avgConfidence = claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length;

    return avgConfidence * 0.6 + sourceFactor * 0.4;
  }

  /**
   * Conflict'leri bul ve çöz
   */
  private findAndResolveConflicts(claims: Claim[], outputs: ModelOutput[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const contradictionPatterns = [
      { positive: /\bshould\b/i, negative: /\bshould not|shouldn't\b/i },
      { positive: /\bis\b/i, negative: /\bis not|isn't\b/i },
      { positive: /\bcan\b/i, negative: /\bcannot|can't\b/i },
      { positive: /\bwill\b/i, negative: /\bwill not|won't\b/i },
    ];

    // Entity-based contradiction detection
    const entityClaims = new Map<string, Claim[]>();
    for (const claim of claims) {
      for (const entity of claim.entities) {
        if (!entityClaims.has(entity)) {
          entityClaims.set(entity, []);
        }
        entityClaims.get(entity)!.push(claim);
      }
    }

    for (const [entity, entityRelatedClaims] of entityClaims) {
      if (entityRelatedClaims.length < 2) continue;

      // Check for contradictions
      for (let i = 0; i < entityRelatedClaims.length; i++) {
        for (let j = i + 1; j < entityRelatedClaims.length; j++) {
          if (entityRelatedClaims[i].source === entityRelatedClaims[j].source) continue;

          if (this.areContradictory(entityRelatedClaims[i], entityRelatedClaims[j], contradictionPatterns)) {
            const winner = this.resolveConflict(
              entityRelatedClaims[i],
              entityRelatedClaims[j],
              outputs
            );

            conflicts.push({
              claims: [entityRelatedClaims[i], entityRelatedClaims[j]],
              resolved: true,
              winner,
              resolution: `Resolved in favor of ${winner.source} based on confidence`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * İki claim çelişiyor mu?
   */
  private areContradictory(
    a: Claim,
    b: Claim,
    patterns: Array<{ positive: RegExp; negative: RegExp }>
  ): boolean {
    // Same entity, different assertions
    const sharedEntities = a.entities.filter(e => b.entities.includes(e));
    if (sharedEntities.length === 0) return false;

    for (const pattern of patterns) {
      if (
        (pattern.positive.test(a.text) && pattern.negative.test(b.text)) ||
        (pattern.negative.test(a.text) && pattern.positive.test(b.text))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Conflict'i çöz
   */
  private resolveConflict(a: Claim, b: Claim, outputs: ModelOutput[]): Claim {
    // Model güvenine bak
    const aOutput = outputs.find(o => o.model === a.source);
    const bOutput = outputs.find(o => o.model === b.source);

    const aScore = (aOutput?.confidence || 0.5) * a.confidence;
    const bScore = (bOutput?.confidence || 0.5) * b.confidence;

    return aScore >= bScore ? a : b;
  }

  /**
   * Final sentezi oluştur
   */
  private synthesize(
    agreements: Agreement[],
    conflicts: Conflict[],
    outputs: ModelOutput[]
  ): string {
    const parts: string[] = [];

    // En güvenilir agreement'lardan başla
    const topAgreements = agreements
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    for (const agreement of topAgreements) {
      // En güvenilir claim'i seç
      const bestClaim = agreement.claims
        .sort((a, b) => b.confidence - a.confidence)[0];
      parts.push(bestClaim.text);
    }

    // Conflict winner'larını ekle
    for (const conflict of conflicts) {
      if (conflict.winner && !parts.some(p => this.textOverlap(p, conflict.winner!.text) > 0.5)) {
        parts.push(conflict.winner.text);
      }
    }

    // Eğer hala az içerik varsa, en güvenilir model çıktısını kullan
    if (parts.length < 3) {
      const bestOutput = outputs.sort((a, b) => b.confidence - a.confidence)[0];
      return bestOutput.response;
    }

    return parts.join(' ');
  }

  /**
   * Text overlap
   */
  private textOverlap(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\W+/));
    const bWords = new Set(b.toLowerCase().split(/\W+/));
    
    let overlap = 0;
    for (const w of aWords) {
      if (bWords.has(w)) overlap++;
    }

    return (2 * overlap) / (aWords.size + bWords.size);
  }

  /**
   * Genel güven hesapla
   */
  private calculateOverallConfidence(
    agreements: Agreement[],
    conflicts: Conflict[],
    outputs: ModelOutput[]
  ): number {
    // Base: ortalama model güveni
    const avgModelConfidence = outputs.reduce((sum, o) => sum + o.confidence, 0) / outputs.length;

    // Agreement bonus
    const agreementBonus = Math.min(0.2, agreements.length * 0.05);

    // Conflict penalty
    const conflictPenalty = Math.min(0.3, conflicts.length * 0.1);

    return Math.max(0.1, Math.min(1, avgModelConfidence + agreementBonus - conflictPenalty));
  }

  /**
   * Reasoning açıklaması
   */
  private explainReasoning(agreements: Agreement[], conflicts: Conflict[]): string {
    const parts: string[] = [];

    if (agreements.length > 0) {
      parts.push(`${agreements.length} agreement(s) found across models`);
    }

    if (conflicts.length > 0) {
      parts.push(`${conflicts.length} conflict(s) resolved`);
    }

    if (parts.length === 0) {
      parts.push('No significant agreements or conflicts detected');
    }

    return parts.join('. ') + '.';
  }

  /**
   * Farklı bilgi kaynaklarını birleştir
   */
  meshKnowledge(
    codeKnowledge: Knowledge,
    graphKnowledge: Knowledge,
    historyKnowledge: Knowledge,
    copilotKnowledge: Knowledge
  ): UnifiedKnowledge {
    const allFacts = [
      ...codeKnowledge.facts,
      ...graphKnowledge.facts,
      ...historyKnowledge.facts,
      ...copilotKnowledge.facts,
    ];

    // Deduplicate facts
    const uniqueFacts = [...new Set(allFacts)];

    // Merge relationships
    const relationshipMap = new Map<string, { from: string; to: string; type: string; sources: string[] }>();
    
    const addRelationships = (rels: Knowledge['relationships'], source: string) => {
      for (const rel of rels) {
        const key = `${rel.from}:${rel.type}:${rel.to}`;
        if (relationshipMap.has(key)) {
          relationshipMap.get(key)!.sources.push(source);
        } else {
          relationshipMap.set(key, { ...rel, sources: [source] });
        }
      }
    };

    addRelationships(codeKnowledge.relationships, 'code');
    addRelationships(graphKnowledge.relationships, 'graph');
    addRelationships(historyKnowledge.relationships, 'history');
    addRelationships(copilotKnowledge.relationships, 'copilot');

    // Calculate overall confidence
    const confidences = [
      codeKnowledge.confidence,
      graphKnowledge.confidence,
      historyKnowledge.confidence,
      copilotKnowledge.confidence,
    ].filter(c => c > 0);

    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.5;

    return {
      facts: uniqueFacts,
      relationships: Array.from(relationshipMap.values()),
      conflicts: [], // TODO: Detect conflicting facts
      confidence: avgConfidence,
    };
  }

  /**
   * Cross-project knowledge ile zenginleştir
   */
  meshCrossProject(
    currentProject: UnifiedKnowledge,
    similarProjects: UnifiedKnowledge[]
  ): EnrichedKnowledge {
    const crossProjectInsights: string[] = [];
    const patterns: string[] = [];
    const suggestions: string[] = [];

    // Similar projects'ten pattern'ları bul
    for (const similar of similarProjects) {
      for (const fact of similar.facts) {
        if (!currentProject.facts.includes(fact)) {
          crossProjectInsights.push(fact);
        }
      }

      // Ortak relationship pattern'ları
      for (const rel of similar.relationships) {
        const hasPattern = currentProject.relationships.some(r =>
          r.type === rel.type
        );
        if (!hasPattern) {
          patterns.push(`${rel.type} pattern: ${rel.from} → ${rel.to}`);
        }
      }
    }

    // Öneriler oluştur
    if (crossProjectInsights.length > 0) {
      suggestions.push(`${crossProjectInsights.length} insight(s) from similar projects`);
    }
    if (patterns.length > 0) {
      suggestions.push(`${patterns.length} pattern(s) could be applied`);
    }

    return {
      ...currentProject,
      crossProjectInsights: crossProjectInsights.slice(0, 10),
      patterns: patterns.slice(0, 10),
      suggestions,
    };
  }
}

// Singleton
let meshEngine: MeshEngine | null = null;

export function getMeshEngine(): MeshEngine {
  if (!meshEngine) {
    meshEngine = new MeshEngine();
  }
  return meshEngine;
}

export default MeshEngine;
