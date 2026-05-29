import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ResourceChange } from '../src/content/types';

const sendMessageMock = vi.fn();
vi.stubGlobal('chrome', {
  runtime: { sendMessage: sendMessageMock },
});

// Import after stubbing so the module sees the mock
const { generateDiffHash, buildPrompt, fetchAISummary } = await import('../src/content/aiSummary');

function makeChange(overrides: Partial<ResourceChange> = {}): ResourceChange {
  return {
    id: 'aws_s3_bucket.data',
    type: 'aws_s3_bucket',
    name: 'data',
    action: 'update',
    filePath: 'main.tf',
    changes: [{ attribute: 'acl', newValue: 'public-read', isSensitive: false }],
    riskProfile: { level: 'medium', reasons: ['Open S3 bucket ACL'], isDestructive: false },
    ...overrides,
  };
}

describe('aiSummary.generateDiffHash', () => {
  it('returns a 64-char hex string', async () => {
    const hash = await generateDiffHash([makeChange()]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for identical inputs', async () => {
    const change = makeChange();
    const h1 = await generateDiffHash([change]);
    const h2 = await generateDiffHash([change]);
    expect(h1).toBe(h2);
  });

  it('returns different hashes for different resource ids', async () => {
    const h1 = await generateDiffHash([makeChange({ id: 'aws_s3_bucket.foo' })]);
    const h2 = await generateDiffHash([makeChange({ id: 'aws_s3_bucket.bar' })]);
    expect(h1).not.toBe(h2);
  });

  it('returns different hashes for different actions', async () => {
    const h1 = await generateDiffHash([makeChange({ action: 'create' })]);
    const h2 = await generateDiffHash([makeChange({ action: 'delete' })]);
    expect(h1).not.toBe(h2);
  });

  it('returns a stable hash for an empty changes array', async () => {
    const h1 = await generateDiffHash([]);
    const h2 = await generateDiffHash([]);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('aiSummary.buildPrompt', () => {
  it('includes the resource id', () => {
    const prompt = buildPrompt([makeChange({ id: 'aws_iam_role.admin' })]);
    expect(prompt).toContain('aws_iam_role.admin');
  });

  it('includes the action in uppercase', () => {
    const prompt = buildPrompt([makeChange({ action: 'delete' })]);
    expect(prompt).toContain('DELETE');
  });

  it('includes the risk level in uppercase', () => {
    const prompt = buildPrompt([
      makeChange({ riskProfile: { level: 'high', reasons: [], isDestructive: true } }),
    ]);
    expect(prompt).toContain('[HIGH]');
  });

  it('includes risk reasons in brackets', () => {
    const prompt = buildPrompt([
      makeChange({
        riskProfile: { level: 'high', reasons: ['IAM wildcard action'], isDestructive: false },
      }),
    ]);
    expect(prompt).toContain('IAM wildcard action');
  });

  it('includes up to 3 attribute changes', () => {
    const prompt = buildPrompt([
      makeChange({
        changes: [
          { attribute: 'a1', newValue: 'v1', isSensitive: false },
          { attribute: 'a2', newValue: 'v2', isSensitive: false },
          { attribute: 'a3', newValue: 'v3', isSensitive: false },
          { attribute: 'a4', newValue: 'v4', isSensitive: false },
        ],
      }),
    ]);
    expect(prompt).toContain('a1=v1');
    expect(prompt).toContain('a3=v3');
    expect(prompt).not.toContain('a4=v4');
  });

  it('starts with the expected preamble', () => {
    const prompt = buildPrompt([makeChange()]);
    expect(prompt.startsWith('You are a Terraform diff reviewer.')).toBe(true);
  });

  it('returns a prompt containing the JSON schema instruction', () => {
    const prompt = buildPrompt([makeChange()]);
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"risks"');
    expect(prompt).toContain('"rollback"');
    expect(prompt).toContain('"prDescription"');
  });

  it('instructs up to 6 rollback steps', () => {
    const prompt = buildPrompt([makeChange()]);
    expect(prompt).toContain('Max 6');
  });

  it('instructs model to produce a markdown PR description', () => {
    const prompt = buildPrompt([makeChange()]);
    expect(prompt).toContain('prDescription');
    expect(prompt).toContain('Markdown PR description');
  });
});

describe('aiSummary.fetchAISummary', () => {
  beforeEach(() => {
    sendMessageMock.mockReset();
  });

  it('returns parsed AISummaryResult on success', async () => {
    const payload = {
      summary: 'S3 bucket made public.',
      risks: ['Public data exposure'],
      rollback: ['Set acl=private'],
      prDescription: '## Summary\nMakes S3 bucket public.',
    };
    sendMessageMock.mockResolvedValue({ content: [{ text: JSON.stringify(payload) }] });

    const result = await fetchAISummary([makeChange()]);
    expect(result).toEqual(payload);
  });

  it('passes the correct message type and model to chrome.runtime.sendMessage', async () => {
    sendMessageMock.mockResolvedValue({
      content: [
        { text: '{"summary":"ok","risks":[],"rollback":[],"prDescription":"## Summary\nok"}' },
      ],
    });

    await fetchAISummary([makeChange()]);

    const call = sendMessageMock.mock.calls[0][0];
    expect(call.type).toBe('FETCH_AI_SUMMARY');
    expect(call.payload.model).toBe('claude-haiku-4-5-20251001');
    expect(call.payload).not.toHaveProperty('apiKey');
  });

  it('parses prDescription from the response', async () => {
    const prDescription =
      '## Summary\nAdds IAM role.\n\n## Pre-merge Checklist\n- [ ] Review policy';
    sendMessageMock.mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            summary: 'Adds IAM role.',
            risks: [],
            rollback: [],
            prDescription,
          }),
        },
      ],
    });

    const result = await fetchAISummary([makeChange()]);
    expect(result?.prDescription).toBe(prDescription);
  });

  it('returns null when prDescription field is missing from response', async () => {
    sendMessageMock.mockResolvedValue({
      content: [{ text: '{"summary":"ok","risks":[],"rollback":[]}' }],
    });
    const result = await fetchAISummary([makeChange()]);
    expect(result).toBeNull();
  });

  it('returns null when background returns an error field', async () => {
    sendMessageMock.mockResolvedValue({ error: 'Unauthorized' });
    const result = await fetchAISummary([makeChange()]);
    expect(result).toBeNull();
  });

  it('returns null when response is null', async () => {
    sendMessageMock.mockResolvedValue(null);
    const result = await fetchAISummary([makeChange()]);
    expect(result).toBeNull();
  });

  it('returns null when response JSON is malformed', async () => {
    sendMessageMock.mockResolvedValue({ content: [{ text: 'not valid json' }] });
    const result = await fetchAISummary([makeChange()]);
    expect(result).toBeNull();
  });

  it('returns null when sendMessage rejects', async () => {
    sendMessageMock.mockRejectedValue(new Error('Extension context invalidated'));
    const result = await fetchAISummary([makeChange()]);
    expect(result).toBeNull();
  });
});
