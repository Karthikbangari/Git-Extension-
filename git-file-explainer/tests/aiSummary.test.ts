import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPrompt, fetchFileSummary, fetchQAAnswer } from '../src/content/aiSummary';

const mockSendMessage = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
    lastError: undefined,
  },
});

describe('buildPrompt', () => {
  it('includes the filename (last path segment) in the prompt', () => {
    const prompt = buildPrompt('src/utils/helper.ts', 'typescript', 'const x = 1;');
    expect(prompt).toContain('helper.ts');
    expect(prompt).not.toContain('src/utils/');
  });

  it('includes the language in the prompt', () => {
    const prompt = buildPrompt('app.py', 'python', 'print("hi")');
    expect(prompt).toContain('python');
  });

  it('includes the file content in the prompt', () => {
    const prompt = buildPrompt('main.go', 'go', 'package main');
    expect(prompt).toContain('package main');
  });

  it('truncates content exceeding 5000 chars and adds a truncation marker', () => {
    const longContent = 'a'.repeat(6000);
    const prompt = buildPrompt('file.ts', 'typescript', longContent);
    expect(prompt).toContain('(truncated)');
    expect(prompt.includes('a'.repeat(5001))).toBe(false);
  });

  it('does not truncate content within the 5000-char limit', () => {
    const content = 'const x = 1;';
    const prompt = buildPrompt('file.ts', 'typescript', content);
    expect(prompt).not.toContain('(truncated)');
    expect(prompt).toContain(content);
  });

  it('handles a plain filename with no directory segments', () => {
    const prompt = buildPrompt('Makefile', 'shell', 'all:\n\t$(MAKE) build');
    expect(prompt).toContain('Makefile');
  });
});

describe('fetchFileSummary', () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    Object.defineProperty(chrome.runtime, 'lastError', { value: undefined, writable: true });
  });

  function respond(payload: unknown) {
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => cb(payload));
  }

  it('returns a FileSummaryResult on a valid response', async () => {
    const valid = {
      summary: 'A helper file.',
      keyPoints: ['Exports a function'],
      complexity: 'low' as const,
    };
    respond({ content: [{ text: JSON.stringify(valid) }] });
    expect(await fetchFileSummary('prompt')).toEqual(valid);
  });

  it('returns null when the response has an error field', async () => {
    respond({ error: 'Missing API key' });
    expect(await fetchFileSummary('prompt')).toBeNull();
  });

  it('returns null when response JSON is malformed', async () => {
    respond({ content: [{ text: 'not valid json {{' }] });
    expect(await fetchFileSummary('prompt')).toBeNull();
  });

  it('returns null when complexity is an invalid value', async () => {
    respond({
      content: [{ text: JSON.stringify({ summary: 'x', keyPoints: [], complexity: 'extreme' }) }],
    });
    expect(await fetchFileSummary('prompt')).toBeNull();
  });

  it('strips ```json code fences before parsing', async () => {
    const valid = { summary: 'A test file.', keyPoints: ['Does X'], complexity: 'medium' as const };
    respond({ content: [{ text: '```json\n' + JSON.stringify(valid) + '\n```' }] });
    expect(await fetchFileSummary('prompt')).toEqual(valid);
  });

  it('strips plain ``` fences before parsing', async () => {
    const valid = { summary: 'A file.', keyPoints: ['Defines Y'], complexity: 'high' as const };
    respond({ content: [{ text: '```\n' + JSON.stringify(valid) + '\n```' }] });
    expect(await fetchFileSummary('prompt')).toEqual(valid);
  });

  it('returns null when the content array is absent', async () => {
    respond({});
    expect(await fetchFileSummary('prompt')).toBeNull();
  });

  it('returns null when keyPoints is not an array', async () => {
    respond({
      content: [
        { text: JSON.stringify({ summary: 'x', keyPoints: 'not-array', complexity: 'low' }) },
      ],
    });
    expect(await fetchFileSummary('prompt')).toBeNull();
  });

  it('returns null when chrome.runtime.lastError is set', async () => {
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      Object.defineProperty(chrome.runtime, 'lastError', {
        value: { message: 'Extension error' },
        writable: true,
      });
      cb(null);
    });
    expect(await fetchFileSummary('prompt')).toBeNull();
  });
});

describe('fetchQAAnswer', () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    Object.defineProperty(chrome.runtime, 'lastError', { value: undefined, writable: true });
  });

  function respond(payload: unknown) {
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => cb(payload));
  }

  it('sends only prompt and model in the Q&A message payload', async () => {
    respond({ content: [{ text: 'It initializes the app.' }] });
    await fetchQAAnswer('What does this do?', 'const app = createApp();');

    expect(mockSendMessage).toHaveBeenCalledWith(
      {
        type: 'GFE_FETCH_QA_ANSWER',
        payload: {
          prompt: expect.stringContaining('What does this do?'),
          model: 'claude-haiku-4-5-20251001',
        },
      },
      expect.any(Function)
    );
    expect(mockSendMessage.mock.calls[0][0].payload).not.toHaveProperty('apiKey');
  });

  it('returns a trimmed answer on a valid Q&A response', async () => {
    respond({ content: [{ text: '  It validates user input.  ' }] });
    expect(await fetchQAAnswer('What happens?', 'function validate() {}')).toBe(
      'It validates user input.'
    );
  });

  it('returns null when the Q&A response has an error field', async () => {
    respond({ error: 'Missing API key' });
    expect(await fetchQAAnswer('Why?', 'const x = 1;')).toBeNull();
  });

  it('returns null when the Q&A content text is absent', async () => {
    respond({ content: [{}] });
    expect(await fetchQAAnswer('Why?', 'const x = 1;')).toBeNull();
  });
});
