/**
 * FuncLib v4 - LLM Reasoning Engine
 * Ollama ile lokal LLM entegrasyonu
 * 
 * v4.1: Retry, Timeout, Cache desteği eklendi
 */

import * as http from 'http';
import * as https from 'https';
import { getLLMCache } from '../core/cache';
import { getLogger } from '../core/logger';

export interface LLMConfig {
  provider: 'ollama' | 'groq' | 'together';
  model: string;
  baseUrl: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;          // ms, default 60000
  retryAttempts?: number;    // default 3
  retryDelay?: number;       // ms, default 1000
  useCache?: boolean;        // default true
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ReasoningResult {
  answer: string;
  confidence: number;
  reasoning: string;
  sources: string[];
  suggestions: string[];
}

const DEFAULT_CONFIGS: Record<string, LLMConfig> = {
  ollama: {
    provider: 'ollama',
    model: 'llama3.2',
    baseUrl: 'http://localhost:11434',
    temperature: 0.3,
    maxTokens: 2000,
    timeout: 60000,
    retryAttempts: 3,
    retryDelay: 1000,
    useCache: true,
  },
  groq: {
    provider: 'groq',
    model: 'llama-3.2-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    temperature: 0.3,
    maxTokens: 2000,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    useCache: true,
  },
  together: {
    provider: 'together',
    model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1',
    temperature: 0.3,
    maxTokens: 2000,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    useCache: true,
  },
};

export class LLMClient {
  private config: LLMConfig;
  private logger = getLogger().child('LLM');
  private cache = getLLMCache();

  constructor(config?: Partial<LLMConfig>) {
    // Önce Ollama dene, yoksa Groq
    this.config = {
      ...DEFAULT_CONFIGS.ollama,
      ...config,
    };
  }

  /**
   * Ollama'nın çalışıp çalışmadığını kontrol et
   */
  async checkOllama(): Promise<boolean> {
    try {
      const response = await this.httpRequest({
        hostname: 'localhost',
        port: 11434,
        path: '/api/tags',
        method: 'GET',
      });
      return response.statusCode === 200;
    } catch {
      return false;
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    const maxAttempts = this.config.retryAttempts ?? 3;
    const baseDelay = this.config.retryDelay ?? 1000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          this.logger.warn(
            `${context} - Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`,
            { error: lastError.message }
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(`${context} - All ${maxAttempts} attempts failed`, { error: lastError?.message });
    throw lastError;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * LLM'e mesaj gönder
   */
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    // Cache key oluştur
    const cacheKey = {
      messages: messages.map(m => m.content).join('|'),
      model: this.config.model,
      temperature: this.config.temperature,
    };

    // Cache kontrolü
    if (this.config.useCache !== false) {
      const cached = this.cache.getResponse(
        cacheKey.messages,
        cacheKey.model,
        cacheKey.temperature
      );
      
      if (cached) {
        this.logger.debug('Cache hit for LLM request');
        return {
          content: cached,
          model: this.config.model,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }
    }

    // API çağrısı with retry
    const response = await this.withRetry(async () => {
      if (this.config.provider === 'ollama') {
        return this.chatOllama(messages);
      } else {
        return this.chatOpenAIFormat(messages);
      }
    }, `LLM chat (${this.config.provider})`);

    // Cache'e kaydet
    if (this.config.useCache !== false && response.content) {
      this.cache.setResponse(
        cacheKey.messages,
        cacheKey.model,
        response.content,
        cacheKey.temperature
      );
    }

    return response;
  }

  /**
   * Ollama API
   */
  private async chatOllama(messages: LLMMessage[]): Promise<LLMResponse> {
    const url = new URL('/api/chat', this.config.baseUrl);
    
    const body = JSON.stringify({
      model: this.config.model,
      messages,
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens,
      },
    });

    try {
      const response = await this.httpRequest({
        hostname: url.hostname,
        port: parseInt(url.port) || 11434,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, body);

      const data = JSON.parse(response.body);
      
      return {
        content: data.message?.content || '',
        model: this.config.model,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error) {
      this.logger.error('Ollama hatası:', { error: (error as Error).message });
      throw new Error('Ollama bağlantı hatası. Ollama çalışıyor mu?');
    }
  }

  /**
   * OpenAI uyumlu API (Groq, Together, vb.)
   */
  private async chatOpenAIFormat(messages: LLMMessage[]): Promise<LLMResponse> {
    const url = new URL('/chat/completions', this.config.baseUrl);
    
    const body = JSON.stringify({
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    const isHttps = url.protocol === 'https:';
    
    const response = await this.httpRequest({
      hostname: url.hostname,
      port: parseInt(url.port) || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    }, body, isHttps);

    const data = JSON.parse(response.body);
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: this.config.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * HTTP request helper with configurable timeout
   */
  private httpRequest(
    options: http.RequestOptions,
    body?: string,
    useHttps: boolean = false
  ): Promise<{ statusCode: number; body: string }> {
    const timeout = this.config.timeout ?? 60000;
    
    return new Promise((resolve, reject) => {
      const lib = useHttps ? https : http;
      
      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: data,
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * Mevcut config
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Provider değiştir
   */
  setProvider(provider: 'ollama' | 'groq' | 'together', apiKey?: string): void {
    this.config = {
      ...DEFAULT_CONFIGS[provider],
      apiKey,
    };
  }
}

export class ReasoningEngine {
  private llm: LLMClient;
  private systemPrompt: string;
  private logger = getLogger().child('Reasoning');

  constructor(llmConfig?: Partial<LLMConfig>) {
    this.llm = new LLMClient(llmConfig);
    this.systemPrompt = `Sen bir kod analiz uzmanısın. Türkçe cevap ver.
Görevin:
1. Kod hakkındaki soruları yanıtlamak
2. Potansiyel bug'ları tespit etmek
3. Refactoring önerileri sunmak
4. Kod değişikliklerinin etkisini analiz etmek

Cevaplarında:
- Kısa ve öz ol
- Kod örnekleri ver
- Riskleri belirt
- Önerilerini sırala`;
  }

  /**
   * Kod hakkında soru sor
   */
  async ask(question: string, context?: {
    code?: string;
    symbols?: Array<{ name: string; kind: string; file: string }>;
    references?: Array<{ symbol: string; file: string; line: number }>;
  }): Promise<ReasoningResult> {
    let userMessage = question;

    if (context) {
      userMessage += '\n\n--- CONTEXT ---\n';
      
      if (context.code) {
        userMessage += `\nKod:\n\`\`\`\n${context.code.slice(0, 2000)}\n\`\`\`\n`;
      }
      
      if (context.symbols && context.symbols.length > 0) {
        userMessage += '\nSemboller:\n';
        context.symbols.slice(0, 20).forEach(s => {
          userMessage += `- ${s.name} (${s.kind}) @ ${s.file}\n`;
        });
      }
      
      if (context.references && context.references.length > 0) {
        userMessage += '\nReferanslar:\n';
        context.references.slice(0, 20).forEach(r => {
          userMessage += `- ${r.symbol} @ ${r.file}:${r.line}\n`;
        });
      }
    }

    try {
      const response = await this.llm.chat([
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userMessage },
      ]);

      return this.parseResponse(response.content);
    } catch (error) {
      this.logger.error('Reasoning hatası:', { error: (error as Error).message });
      return {
        answer: 'LLM bağlantı hatası. Ollama çalışıyor mu? `ollama serve` komutunu deneyin.',
        confidence: 0,
        reasoning: 'Hata oluştu',
        sources: [],
        suggestions: ['Ollama kurulumunu kontrol edin'],
      };
    }
  }

  /**
   * Bug tahmini
   */
  async predictBugs(code: string, context?: string): Promise<ReasoningResult> {
    const prompt = `Bu kodda potansiyel bug'ları tespit et:

\`\`\`
${code.slice(0, 3000)}
\`\`\`

${context ? `Ek bilgi: ${context}` : ''}

Her bug için:
1. Satır numarası (varsa)
2. Bug türü (null reference, race condition, vb.)
3. Açıklama
4. Önerilen düzeltme`;

    return this.ask(prompt);
  }

  /**
   * Etki analizi
   */
  async analyzeImpact(change: string, affectedSymbols: string[]): Promise<ReasoningResult> {
    const prompt = `Bu değişikliğin etkisini analiz et:

Değişiklik: ${change}

Etkilenen semboller (${affectedSymbols.length}):
${affectedSymbols.slice(0, 30).map(s => `- ${s}`).join('\n')}

Analiz et:
1. Risk seviyesi (düşük/orta/yüksek/kritik)
2. Potansiyel yan etkiler
3. Test edilmesi gerekenler
4. Güvenli değişiklik planı`;

    return this.ask(prompt);
  }

  /**
   * Refactoring önerisi
   */
  async suggestRefactoring(code: string, goal?: string): Promise<ReasoningResult> {
    const prompt = `Bu kodu nasıl refactor edebilirim?

\`\`\`
${code.slice(0, 3000)}
\`\`\`

${goal ? `Hedef: ${goal}` : ''}

Öner:
1. Hangi pattern kullanılmalı
2. Nasıl bölünmeli
3. Örnek kod
4. Dikkat edilmesi gerekenler`;

    return this.ask(prompt);
  }

  /**
   * LLM cevabını parse et
   */
  private parseResponse(content: string): ReasoningResult {
    // Basit parsing - gerçek uygulamada daha sofistike olabilir
    const lines = content.split('\n');
    const suggestions: string[] = [];
    
    // Numaralı maddeleri bul
    lines.forEach(line => {
      const match = line.match(/^\d+\.\s+(.+)/);
      if (match) {
        suggestions.push(match[1]);
      }
    });

    // Risk seviyesi ara
    let confidence = 0.5;
    if (content.toLowerCase().includes('kritik') || content.toLowerCase().includes('critical')) {
      confidence = 0.9;
    } else if (content.toLowerCase().includes('yüksek') || content.toLowerCase().includes('high')) {
      confidence = 0.7;
    } else if (content.toLowerCase().includes('düşük') || content.toLowerCase().includes('low')) {
      confidence = 0.3;
    }

    return {
      answer: content,
      confidence,
      reasoning: 'LLM analizi',
      sources: [],
      suggestions: suggestions.slice(0, 10),
    };
  }

  /**
   * Ollama durumunu kontrol et
   */
  async checkHealth(): Promise<{ available: boolean; model: string; provider: string }> {
    const config = this.llm.getConfig();
    
    if (config.provider === 'ollama') {
      const available = await this.llm.checkOllama();
      return {
        available,
        model: config.model,
        provider: config.provider,
      };
    }

    // API key varsa çalışır kabul et
    return {
      available: !!config.apiKey,
      model: config.model,
      provider: config.provider,
    };
  }
}

// Singleton
let reasoningInstance: ReasoningEngine | null = null;

export function getReasoningEngine(config?: Partial<LLMConfig>): ReasoningEngine {
  if (!reasoningInstance) {
    reasoningInstance = new ReasoningEngine(config);
  }
  return reasoningInstance;
}

export default ReasoningEngine;
