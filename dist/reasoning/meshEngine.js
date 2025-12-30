"use strict";
/**
 * FuncLib v4 - Mesh Engine
 * Birden fazla model çıktısını birleştir, consensus oluştur
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshEngine = void 0;
exports.getMeshEngine = getMeshEngine;
class MeshEngine {
    claimIdCounter = 0;
    /**
     * Birden fazla model çıktısını birleştir
     */
    meshModelOutputs(outputs) {
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
    extractClaims(output) {
        const claims = [];
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
    splitIntoSentences(text) {
        // Basit sentence splitting
        return text
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 10);
    }
    /**
     * Claim tipini belirle
     */
    classifyClaimType(sentence) {
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
    extractEntities(sentence) {
        const entities = [];
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
    sentenceConfidence(sentence) {
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
    findAgreements(claims) {
        const agreements = [];
        const processed = new Set();
        for (let i = 0; i < claims.length; i++) {
            if (processed.has(claims[i].id))
                continue;
            const similar = [claims[i]];
            for (let j = i + 1; j < claims.length; j++) {
                if (processed.has(claims[j].id))
                    continue;
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
    calculateSimilarity(a, b) {
        // Entity overlap
        const aEntities = new Set(a.entities);
        const bEntities = new Set(b.entities);
        let entityOverlap = 0;
        for (const e of aEntities) {
            if (bEntities.has(e))
                entityOverlap++;
        }
        const entitySim = aEntities.size + bEntities.size > 0
            ? (2 * entityOverlap) / (aEntities.size + bEntities.size)
            : 0;
        // Word overlap
        const aWords = new Set(a.text.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        const bWords = new Set(b.text.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        let wordOverlap = 0;
        for (const w of aWords) {
            if (bWords.has(w))
                wordOverlap++;
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
    calculateAgreementConfidence(claims) {
        // Daha fazla kaynak = daha yüksek güven
        const sourceFactor = Math.min(1, claims.length / 3);
        // Ortalama claim güveni
        const avgConfidence = claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length;
        return avgConfidence * 0.6 + sourceFactor * 0.4;
    }
    /**
     * Conflict'leri bul ve çöz
     */
    findAndResolveConflicts(claims, outputs) {
        const conflicts = [];
        const contradictionPatterns = [
            { positive: /\bshould\b/i, negative: /\bshould not|shouldn't\b/i },
            { positive: /\bis\b/i, negative: /\bis not|isn't\b/i },
            { positive: /\bcan\b/i, negative: /\bcannot|can't\b/i },
            { positive: /\bwill\b/i, negative: /\bwill not|won't\b/i },
        ];
        // Entity-based contradiction detection
        const entityClaims = new Map();
        for (const claim of claims) {
            for (const entity of claim.entities) {
                if (!entityClaims.has(entity)) {
                    entityClaims.set(entity, []);
                }
                entityClaims.get(entity).push(claim);
            }
        }
        for (const [entity, entityRelatedClaims] of entityClaims) {
            if (entityRelatedClaims.length < 2)
                continue;
            // Check for contradictions
            for (let i = 0; i < entityRelatedClaims.length; i++) {
                for (let j = i + 1; j < entityRelatedClaims.length; j++) {
                    if (entityRelatedClaims[i].source === entityRelatedClaims[j].source)
                        continue;
                    if (this.areContradictory(entityRelatedClaims[i], entityRelatedClaims[j], contradictionPatterns)) {
                        const winner = this.resolveConflict(entityRelatedClaims[i], entityRelatedClaims[j], outputs);
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
    areContradictory(a, b, patterns) {
        // Same entity, different assertions
        const sharedEntities = a.entities.filter(e => b.entities.includes(e));
        if (sharedEntities.length === 0)
            return false;
        for (const pattern of patterns) {
            if ((pattern.positive.test(a.text) && pattern.negative.test(b.text)) ||
                (pattern.negative.test(a.text) && pattern.positive.test(b.text))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Conflict'i çöz
     */
    resolveConflict(a, b, outputs) {
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
    synthesize(agreements, conflicts, outputs) {
        const parts = [];
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
            if (conflict.winner && !parts.some(p => this.textOverlap(p, conflict.winner.text) > 0.5)) {
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
    textOverlap(a, b) {
        const aWords = new Set(a.toLowerCase().split(/\W+/));
        const bWords = new Set(b.toLowerCase().split(/\W+/));
        let overlap = 0;
        for (const w of aWords) {
            if (bWords.has(w))
                overlap++;
        }
        return (2 * overlap) / (aWords.size + bWords.size);
    }
    /**
     * Genel güven hesapla
     */
    calculateOverallConfidence(agreements, conflicts, outputs) {
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
    explainReasoning(agreements, conflicts) {
        const parts = [];
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
    meshKnowledge(codeKnowledge, graphKnowledge, historyKnowledge, copilotKnowledge) {
        const allFacts = [
            ...codeKnowledge.facts,
            ...graphKnowledge.facts,
            ...historyKnowledge.facts,
            ...copilotKnowledge.facts,
        ];
        // Deduplicate facts
        const uniqueFacts = [...new Set(allFacts)];
        // Merge relationships
        const relationshipMap = new Map();
        const addRelationships = (rels, source) => {
            for (const rel of rels) {
                const key = `${rel.from}:${rel.type}:${rel.to}`;
                if (relationshipMap.has(key)) {
                    relationshipMap.get(key).sources.push(source);
                }
                else {
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
    meshCrossProject(currentProject, similarProjects) {
        const crossProjectInsights = [];
        const patterns = [];
        const suggestions = [];
        // Similar projects'ten pattern'ları bul
        for (const similar of similarProjects) {
            for (const fact of similar.facts) {
                if (!currentProject.facts.includes(fact)) {
                    crossProjectInsights.push(fact);
                }
            }
            // Ortak relationship pattern'ları
            for (const rel of similar.relationships) {
                const hasPattern = currentProject.relationships.some(r => r.type === rel.type);
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
exports.MeshEngine = MeshEngine;
// Singleton
let meshEngine = null;
function getMeshEngine() {
    if (!meshEngine) {
        meshEngine = new MeshEngine();
    }
    return meshEngine;
}
exports.default = MeshEngine;
//# sourceMappingURL=meshEngine.js.map