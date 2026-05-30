import type { ResourceChange, AISummaryResult } from './types';

export type { AISummaryResult };

export async function generateDiffHash(changes: ResourceChange[]): Promise<string> {
  const CACHE_VERSION = 'v2'; // increment to bust all cached AI summaries
  const simplified = changes.map((c) => ({
    id: c.id,
    action: c.action,
    attrs: c.changes.map((a) =>
      a.isSensitive ? `${a.attribute}:<sensitive>` : `${a.attribute}:${a.newValue ?? ''}`
    ),
  }));

  const msgBuffer = new TextEncoder().encode(JSON.stringify(simplified) + CACHE_VERSION);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildPrompt(changes: ResourceChange[]): string {
  const changeList = changes
    .map((c) => {
      const risk = c.riskProfile.level.toUpperCase();
      const reasons = c.riskProfile.reasons.length ? ` (${c.riskProfile.reasons.join(', ')})` : '';
      const attrs = c.changes
        .filter((a) => !a.isSensitive)
        .slice(0, 3)
        .map((a) => `${a.attribute}=${a.newValue}`)
        .join(', ');
      return `- ${c.action.toUpperCase()} ${c.id} [${risk}${reasons}]: ${attrs}`;
    })
    .join('\n');

  return `You are a Terraform diff reviewer. Analyze these resource changes and respond with valid JSON only.

Changes:
${changeList}

Respond with exactly this JSON schema:
{"summary":"...","risks":["..."],"rollback":["step 1...","step 2..."],"prDescription":"..."}

Rules:
1. summary: 2-4 sentences explaining the high-level impact.
2. risks: Max 3 specific security or operational risks, each prefixed [HIGH], [MEDIUM], or [LOW].
3. rollback: Max 6 concrete ordered steps to safely revert these changes.
4. prDescription: Markdown PR description with sections ## Summary, ## Changes, ## Risk Assessment, ## Pre-merge Checklist (with checkbox items).
5. Respond ONLY with the JSON object.`;
}

export async function fetchAISummary(changes: ResourceChange[]): Promise<AISummaryResult | null> {
  try {
    const prompt = buildPrompt(changes);

    // Routed through background service worker — content scripts run in the host page's
    // security context and can be blocked by the page's own CSP headers.
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_AI_SUMMARY',
      payload: { prompt, model: 'claude-haiku-4-5-20251001' },
    });

    if (!response || response.error) throw new Error(response?.error || 'Empty response');
    if (!Array.isArray(response.content) || !response.content[0]?.text) {
      throw new Error('Unexpected response format');
    }
    // Models sometimes wrap JSON in markdown code fences — strip them before parsing
    const rawText: string = response.content[0].text;
    const jsonText = rawText
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
    const parsed = JSON.parse(jsonText);
    if (
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.risks) ||
      !Array.isArray(parsed.rollback) ||
      typeof parsed.prDescription !== 'string'
    ) {
      throw new Error('Invalid AI response shape');
    }
    return parsed as AISummaryResult;
  } catch (error) {
    console.error('TFE: AI Summary failed', error);
    return null;
  }
}
