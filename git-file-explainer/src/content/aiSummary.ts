import type { FileSummaryResult } from './types';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CONTENT_CHARS = 5000;

export function buildPrompt(filePath: string, language: string, content: string): string {
  const filename = filePath.split('/').pop() ?? filePath;
  const truncated =
    content.length > MAX_CONTENT_CHARS
      ? content.slice(0, MAX_CONTENT_CHARS) + '\n... (truncated)'
      : content;

  return `You are a code reviewer. Analyse this ${language} file and respond with valid JSON only.

File: ${filename}

Content:
${truncated}

Respond with exactly this JSON:
{"summary":"...","keyPoints":["..."],"complexity":"low"}

Rules:
- summary: 2-3 sentences describing what the file does
- keyPoints: max 5 items, each starting with a verb
- complexity: one of "low", "medium", or "high"`;
}

export async function fetchFileSummary(prompt: string): Promise<FileSummaryResult | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GFE_FETCH_AI_SUMMARY', payload: { prompt, model: MODEL } },
      (response: unknown) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        try {
          const res = response as {
            content?: Array<{ text?: string }>;
            error?: string;
          } | null;
          if (!res || res.error) {
            resolve(null);
            return;
          }
          const text = res.content?.[0]?.text;
          if (typeof text !== 'string') {
            resolve(null);
            return;
          }
          const stripped = text
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
          const parsed = JSON.parse(stripped) as unknown;
          if (
            typeof parsed !== 'object' ||
            parsed === null ||
            typeof (parsed as Record<string, unknown>).summary !== 'string' ||
            !Array.isArray((parsed as Record<string, unknown>).keyPoints) ||
            !['low', 'medium', 'high'].includes(
              (parsed as Record<string, unknown>).complexity as string
            )
          ) {
            resolve(null);
            return;
          }
          resolve(parsed as FileSummaryResult);
        } catch {
          resolve(null);
        }
      }
    );
  });
}
