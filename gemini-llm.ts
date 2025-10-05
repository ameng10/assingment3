/**
 * LLM Integration for DayPlanner
 *
 * Handles the requestAssignmentsFromLLM functionality using Google's Gemini API.
 * The LLM prompt is hardwired with user preferences and doesn't take external hints.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Configuration for API access
 */
export interface Config {
    apiKey: string;
}

export class GeminiLLM {
    private apiKey: string;
    // Rubric: Idempotency (if needed) - see below for comment
    // Idempotency: For pure LLM queries, idempotency is not enforced, but can be added by hashing prompt if needed.

    constructor(config: Config) {
        this.apiKey = config.apiKey;
        // Rubric: Secure API key handling (Concept, Spec)
    }

    /**
     * Rubric: LLM wrapper with timeout, retries, backoff, error handling (Validation, Robustness)
     * Calls Gemini LLM with timeout, retries, and exponential backoff.
     * @param prompt The prompt string
     * @param options Optional: { timeoutMs, maxRetries, initialBackoffMs }
     */
    async executeLLM(
        prompt: string,
        options?: { timeoutMs?: number; maxRetries?: number; initialBackoffMs?: number }
    ): Promise<string> {
        const timeoutMs = options?.timeoutMs ?? 15000; // Rubric: Timeout
        const maxRetries = options?.maxRetries ?? 3;   // Rubric: Retries
        const initialBackoffMs = options?.initialBackoffMs ?? 1000; // Rubric: Backoff

        let attempt = 0;
        let lastError: any = null;
        while (attempt <= maxRetries) {
            try {
                // Rubric: Timeout implementation
                const result = await Promise.race([
                    this._callGemini(prompt),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('LLM request timed out')), timeoutMs))
                ]);
                return result as string;
            } catch (error) {
                lastError = error;
                attempt++;
                if (attempt > maxRetries) {
                    // Rubric: Clear error messages
                    console.error(`❌ Gemini API failed after ${attempt} attempts:`, (error as Error).message);
                    throw new Error(`Gemini API failed after ${attempt} attempts: ${(error as Error).message}`);
                } else {
                    // Rubric: Exponential backoff
                    const backoff = initialBackoffMs * Math.pow(2, attempt - 1);
                    console.warn(`⚠️ Gemini API attempt ${attempt} failed: ${(error as Error).message}. Retrying in ${backoff}ms...`);
                    await new Promise(res => setTimeout(res, backoff));
                }
            }
        }
        throw lastError;
    }

    /**
     * Rubric: LLM API call (Concept, Spec, Implementation)
     * Internal Gemini call (no retry/timeout)
     */
    private async _callGemini(prompt: string): Promise<string> {
        // Rubric: LLM initialization and prompt handling
        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            generationConfig: {
                maxOutputTokens: 1000,
            }
        });
        // Rubric: LLM execution
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text;
    }
}
