import type { FileSummaryResult } from './types';
import type { Audience } from '../utils/storage';
import { addTokenUsage } from '../utils/storage';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CONTENT_CHARS = 12_000;
export const MAX_QUESTION_CHARS = 280;

const LANGUAGE_ADDENDUM: Record<string, string> = {
  sql: 'Focus on: tables referenced, query purpose, and any performance implications.',
  yaml: 'Focus on: configuration structure, key settings, and what system this configures.',
  yml: 'Focus on: configuration structure, key settings, and what system this configures.',
  json: 'Focus on: data structure, top-level keys, and what system consumes this.',
  toml: 'Focus on: configuration structure, key settings, and what system this configures.',
  dockerfile: 'Focus on: base image, installed tools, exposed ports, and the entry point.',
  markdown: 'Focus on: document purpose, main sections, and intended audience.',
  sql_schema: 'Focus on: table definitions, relationships, and indexes.',
};

function languageAddendum(language: string): string {
  return LANGUAGE_ADDENDUM[language.toLowerCase()] ?? '';
}

export function buildPrompt(
  filePath: string,
  language: string,
  content: string,
  audience: Audience = 'developer'
): string {
  const filename = filePath.split('/').pop() ?? filePath;
  const truncated =
    content.length > MAX_CONTENT_CHARS
      ? content.slice(0, MAX_CONTENT_CHARS) + '\n... (truncated)'
      : content;
  const addendum = languageAddendum(language);

  if (audience === 'non-technical') {
    return `You are a helpful guide explaining code to someone who does not code. Use plain English with no jargon.

File: ${filename} (${language})

Content:
${truncated}

Respond with exactly this JSON:
{"summary":"...","keyPoints":["..."],"analogy":"...","watchOutFor":["..."],"complexity":"low"}

Rules:
- summary: 2-3 plain-English sentences, no technical terms
- keyPoints: max 5 items, each starting with a verb, plain language
- analogy: one real-world sentence starting with "Like a …" or "Think of this as …"
- watchOutFor: max 3 issues written in plain language (TODOs, hard-coded values, anything that could break)
- complexity: one of "low", "medium", "high"${addendum ? `\n\nAdditional context: ${addendum}` : ''}`;
  }

  // developer mode (default)
  return `You are a code reviewer. Analyse this ${language} file and respond with valid JSON only.

File: ${filename}

Content:
${truncated}

Respond with exactly this JSON:
{"summary":"...","keyPoints":["..."],"connections":["..."],"watchOutFor":["..."],"complexity":"low"}

Rules:
- summary: 2-3 technical sentences describing what the file does
- keyPoints: max 5 items — key functions, classes, or exports, each starting with a verb
- connections: max 3 items describing what this file imports from or is imported by (inferred from content)
- watchOutFor: max 3 items — TODOs, hardcoded values, security concerns, or complexity hotspots
- complexity: one of "low", "medium", "high"${addendum ? `\n\nAdditional context: ${addendum}` : ''}`;
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
            usage?: { input_tokens?: number; output_tokens?: number };
            error?: string;
          } | null;
          if (!res || res.error) {
            resolve(null);
            return;
          }

          // Track token usage
          if (res.usage) {
            void addTokenUsage(res.usage.input_tokens ?? 0, res.usage.output_tokens ?? 0);
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

export function buildQAPrompt(
  question: string,
  filePath: string,
  language: string,
  content: string,
  priorSummary?: string
): string {
  const filename = filePath.split('/').pop() ?? filePath;
  const truncated =
    content.length > MAX_CONTENT_CHARS
      ? content.slice(0, MAX_CONTENT_CHARS) + '\n... (truncated)'
      : content;
  const q = question.slice(0, MAX_QUESTION_CHARS);
  const summaryContext = priorSummary ? `\nPrior summary: ${priorSummary}\n` : '';

  return `You are a helpful code reviewer. Answer the question about this ${language} file in 2-4 sentences. Be direct and specific. Plain text only — no markdown headers, no bullet lists.

File: ${filename}
${summaryContext}
Content:
${truncated}

Question: ${q}`;
}

export async function fetchQAAnswer(prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GFE_FETCH_QA_ANSWER', payload: { prompt, model: MODEL } },
      (response: unknown) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        try {
          const res = response as {
            content?: Array<{ text?: string }>;
            usage?: { input_tokens?: number; output_tokens?: number };
            error?: string;
          } | null;
          if (!res || res.error) {
            resolve(null);
            return;
          }
          if (res.usage) {
            void addTokenUsage(res.usage.input_tokens ?? 0, res.usage.output_tokens ?? 0);
          }
          const text = res.content?.[0]?.text;
          resolve(typeof text === 'string' && text.trim() ? text.trim() : null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

/** Open a long-lived port for streaming Q&A. Calls onChunk for each token; resolves full text on done. */
export function streamQAAnswer(
  prompt: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }

    let port: chrome.runtime.Port | null = null;
    let fullText = '';
    let settled = false;

    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      port?.disconnect();
      resolve(result);
    };

    try {
      port = chrome.runtime.connect({ name: 'gfe-stream-qa' });
    } catch {
      resolve(null);
      return;
    }

    signal?.addEventListener('abort', () => finish(null));

    port.onMessage.addListener((msg: unknown) => {
      const m = msg as { chunk?: string; done?: boolean; error?: string };
      if (m.error) {
        finish(null);
        return;
      }
      if (m.chunk) {
        fullText += m.chunk;
        onChunk(m.chunk);
      }
      if (m.done) finish(fullText || null);
    });

    port.onDisconnect.addListener(() => finish(fullText || null));

    port.postMessage({ type: 'GFE_STREAM_QA', payload: { prompt, model: MODEL } });
  });
}
