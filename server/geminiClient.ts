import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

const cleanModelName = (name?: string): string => {
  if (!name) return '';
  return name.replace(/^models\//, '').trim();
};

export const DEFAULT_MODEL = cleanModelName(process.env.GEMINI_MODEL) || 'gemini-flash-latest';

// Candidate models for automatic failover when a model experiences high demand spikes (503 / 429)
export const RESILIENT_FALLBACK_MODELS = [
  cleanModelName(process.env.GEMINI_MODEL),
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
].filter((m): m is string => Boolean(m) && m.length > 0);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface GenerateAIOptions {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  preferredModel?: string;
  temperature?: number;
}

/**
 * Robust AI content generation with automatic exponential backoff,
 * candidate model cascading, and resilience against 503 "high demand" spikes.
 */
export async function generateAIContent(options: GenerateAIOptions): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();

  const modelsToTry = Array.from(
    new Set([
      ...(options.preferredModel ? [cleanModelName(options.preferredModel)] : []),
      ...RESILIENT_FALLBACK_MODELS,
    ])
  );

  let lastError: any = null;

  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const model = modelsToTry[attempt];

    // Try each model with up to 2 attempts with backoff if experiencing 503
    for (let retry = 0; retry < 2; retry++) {
      try {
        const config: any = {};
        if (options.systemInstruction) config.systemInstruction = options.systemInstruction;
        if (options.responseMimeType) config.responseMimeType = options.responseMimeType;
        if (typeof options.temperature === 'number') config.temperature = options.temperature;

        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config,
        });

        const text = response.text || '';
        return { text, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const is503 = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');
        const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');

        if ((is503 || is429) && retry === 0) {
          // Brief pause before retry or fallback
          await sleep(1000 + Math.random() * 500);
          continue;
        }

        // If not recoverable on this model, break to try next fallback model
        break;
      }
    }
  }

  throw lastError || new Error('All AI model candidate fallbacks were exhausted');
}
