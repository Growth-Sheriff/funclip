/**
 * FuncLib v4 - Multi-Model Ensemble
 * Birden fazla LLM'i koordineli şekilde kullan
 */

import { LLMClient, LLMConfig, LLMResponse } from './llmClient';

export interface ModelConfig {
  name: string;
  provider: 'ollama' | 'groq' | 'together';
  model: string;
  baseUrl: string;
  apiKey?: string;
  priority: number;
  specialties: string[];
  maxTokens?: number;
}

export interface EnsembleConfig {
  models: ModelConfig[];
  strategy: 'first_available' | 'best_for_task' | 'consensus' | 'cascade';
  timeout: number;
  retries: number;
}

export interface EnsembleResult {
  response: string;
  model: string;
  confidence: number;
  alternatives: Array<{ model: string; response: string; confidence: number }>;
  metadata: {
    strategy: string;
    totalTime: number;
    tokensUsed: number;
    modelsConsulted: string[];
  };
}

export interface TaskClassification {
  type: 'code' | 'debugging' | 'refactoring' | 'documentation' | 'general';
  complexity: 'simple' | 'medium' | 'complex';
  language?: string;
  context?: string;
}

export class MultiModelEnsemble {
  private config: EnsembleConfig;
  private clients: Map<string, LLMClient> = new Map();

  constructor(config?: Partial<EnsembleConfig>) {
    this.config = {
      models: config?.models || [],
      strategy: config?.strategy || 'first_available',
      timeout: config?.timeout || 30000,
      retries: config?.retries || 2,
    };
  }

  addModel(modelConfig: ModelConfig): void {
    this.config.models.push(modelConfig);
    
    const llmConfig: LLMConfig = {
      provider: modelConfig.provider,
      model: modelConfig.model,
      baseUrl: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey,
      maxTokens: modelConfig.maxTokens || 2048,
      temperature: 0.7,
    };

    this.clients.set(modelConfig.name, new LLMClient(llmConfig));
  }

  removeModel(name: string): void {
    this.config.models = this.config.models.filter(m => m.name !== name);
    this.clients.delete(name);
  }

  async query(prompt: string, systemPrompt?: string): Promise<EnsembleResult> {
    const startTime = Date.now();
    const modelsConsulted: string[] = [];
    const alternatives: Array<{ model: string; response: string; confidence: number }> = [];

    // Strategy: first_available
    for (const modelConfig of this.config.models) {
      modelsConsulted.push(modelConfig.name);
      
      try {
        const client = this.clients.get(modelConfig.name);
        if (!client) continue;

        const response = await client.chat([
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
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
      } catch (error) {
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

  async queryForCode(code: string, instruction: string): Promise<EnsembleResult> {
    const prompt = `Code:\n\`\`\`\n${code}\n\`\`\`\n\nInstruction: ${instruction}`;
    const systemPrompt = 'You are an expert programmer. Analyze the code and respond to the instruction.';
    return this.query(prompt, systemPrompt);
  }

  async queryForDebugging(code: string, error: string): Promise<EnsembleResult> {
    const prompt = `Code:\n\`\`\`\n${code}\n\`\`\`\n\nError: ${error}\n\nPlease debug this code and explain the issue.`;
    const systemPrompt = 'You are an expert debugger. Identify the bug and provide a fix.';
    return this.query(prompt, systemPrompt);
  }

  async queryForRefactoring(code: string): Promise<EnsembleResult> {
    const prompt = `Please refactor this code for better readability and maintainability:\n\`\`\`\n${code}\n\`\`\``;
    const systemPrompt = 'You are an expert code reviewer. Suggest improvements while maintaining functionality.';
    return this.query(prompt, systemPrompt);
  }

  classifyTask(prompt: string): TaskClassification {
    const lowerPrompt = prompt.toLowerCase();

    let type: TaskClassification['type'] = 'general';
    if (lowerPrompt.includes('debug') || lowerPrompt.includes('error') || lowerPrompt.includes('fix')) {
      type = 'debugging';
    } else if (lowerPrompt.includes('refactor') || lowerPrompt.includes('improve')) {
      type = 'refactoring';
    } else if (lowerPrompt.includes('document') || lowerPrompt.includes('explain')) {
      type = 'documentation';
    } else if (lowerPrompt.includes('code') || lowerPrompt.includes('implement') || lowerPrompt.includes('function')) {
      type = 'code';
    }

    let complexity: TaskClassification['complexity'] = 'simple';
    if (prompt.length > 500) complexity = 'complex';
    else if (prompt.length > 200) complexity = 'medium';

    return { type, complexity };
  }

  selectModelsForTask(task: TaskClassification): ModelConfig[] {
    return this.config.models
      .filter(m => {
        // All models can handle any task
        return true;
      })
      .sort((a, b) => {
        // Prefer models that specialize in this task type
        const aScore = a.specialties.includes(task.type) ? 1 : 0;
        const bScore = b.specialties.includes(task.type) ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore;
        return a.priority - b.priority;
      });
  }

  getModels(): ModelConfig[] {
    return [...this.config.models];
  }

  getConfig(): EnsembleConfig {
    return { ...this.config };
  }
}

let instance: MultiModelEnsemble | null = null;

export function getMultiModelEnsemble(config?: Partial<EnsembleConfig>): MultiModelEnsemble {
  if (!instance) {
    instance = new MultiModelEnsemble(config);
  }
  return instance;
}

export default MultiModelEnsemble;
