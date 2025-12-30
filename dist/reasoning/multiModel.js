"use strict";
/**
 * FuncLib v4 - Multi-Model Ensemble
 * Birden fazla LLM'i koordineli şekilde kullan
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiModelEnsemble = void 0;
exports.getMultiModelEnsemble = getMultiModelEnsemble;
const llmClient_1 = require("./llmClient");
class MultiModelEnsemble {
    config;
    clients = new Map();
    constructor(config) {
        this.config = {
            models: config?.models || [],
            strategy: config?.strategy || 'first_available',
            timeout: config?.timeout || 30000,
            retries: config?.retries || 2,
        };
    }
    addModel(modelConfig) {
        this.config.models.push(modelConfig);
        const llmConfig = {
            provider: modelConfig.provider,
            model: modelConfig.model,
            baseUrl: modelConfig.baseUrl,
            apiKey: modelConfig.apiKey,
            maxTokens: modelConfig.maxTokens || 2048,
            temperature: 0.7,
        };
        this.clients.set(modelConfig.name, new llmClient_1.LLMClient(llmConfig));
    }
    removeModel(name) {
        this.config.models = this.config.models.filter(m => m.name !== name);
        this.clients.delete(name);
    }
    async query(prompt, systemPrompt) {
        const startTime = Date.now();
        const modelsConsulted = [];
        const alternatives = [];
        // Strategy: first_available
        for (const modelConfig of this.config.models) {
            modelsConsulted.push(modelConfig.name);
            try {
                const client = this.clients.get(modelConfig.name);
                if (!client)
                    continue;
                const response = await client.chat([
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: prompt },
                ]);
                return {
                    response: response.content,
                    model: modelConfig.name,
                    confidence: 0.8,
                    alternatives,
                    metadata: {
                        strategy: this.config.strategy,
                        totalTime: Date.now() - startTime,
                        tokensUsed: (response.usage?.promptTokens || 0) + (response.usage?.completionTokens || 0),
                        modelsConsulted,
                    },
                };
            }
            catch (error) {
                // Try next model
                alternatives.push({
                    model: modelConfig.name,
                    response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    confidence: 0,
                });
            }
        }
        // No model succeeded
        return {
            response: 'All models failed to respond',
            model: 'none',
            confidence: 0,
            alternatives,
            metadata: {
                strategy: this.config.strategy,
                totalTime: Date.now() - startTime,
                tokensUsed: 0,
                modelsConsulted,
            },
        };
    }
    async queryForCode(code, instruction) {
        const prompt = `Code:\n\`\`\`\n${code}\n\`\`\`\n\nInstruction: ${instruction}`;
        const systemPrompt = 'You are an expert programmer. Analyze the code and respond to the instruction.';
        return this.query(prompt, systemPrompt);
    }
    async queryForDebugging(code, error) {
        const prompt = `Code:\n\`\`\`\n${code}\n\`\`\`\n\nError: ${error}\n\nPlease debug this code and explain the issue.`;
        const systemPrompt = 'You are an expert debugger. Identify the bug and provide a fix.';
        return this.query(prompt, systemPrompt);
    }
    async queryForRefactoring(code) {
        const prompt = `Please refactor this code for better readability and maintainability:\n\`\`\`\n${code}\n\`\`\``;
        const systemPrompt = 'You are an expert code reviewer. Suggest improvements while maintaining functionality.';
        return this.query(prompt, systemPrompt);
    }
    classifyTask(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        let type = 'general';
        if (lowerPrompt.includes('debug') || lowerPrompt.includes('error') || lowerPrompt.includes('fix')) {
            type = 'debugging';
        }
        else if (lowerPrompt.includes('refactor') || lowerPrompt.includes('improve')) {
            type = 'refactoring';
        }
        else if (lowerPrompt.includes('document') || lowerPrompt.includes('explain')) {
            type = 'documentation';
        }
        else if (lowerPrompt.includes('code') || lowerPrompt.includes('implement') || lowerPrompt.includes('function')) {
            type = 'code';
        }
        let complexity = 'simple';
        if (prompt.length > 500)
            complexity = 'complex';
        else if (prompt.length > 200)
            complexity = 'medium';
        return { type, complexity };
    }
    selectModelsForTask(task) {
        return this.config.models
            .filter(m => {
            // All models can handle any task
            return true;
        })
            .sort((a, b) => {
            // Prefer models that specialize in this task type
            const aScore = a.specialties.includes(task.type) ? 1 : 0;
            const bScore = b.specialties.includes(task.type) ? 1 : 0;
            if (aScore !== bScore)
                return bScore - aScore;
            return a.priority - b.priority;
        });
    }
    getModels() {
        return [...this.config.models];
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.MultiModelEnsemble = MultiModelEnsemble;
let instance = null;
function getMultiModelEnsemble(config) {
    if (!instance) {
        instance = new MultiModelEnsemble(config);
    }
    return instance;
}
exports.default = MultiModelEnsemble;
//# sourceMappingURL=multiModel.js.map