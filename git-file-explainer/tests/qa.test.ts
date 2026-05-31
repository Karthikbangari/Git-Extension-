import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildQAPrompt, fetchQAAnswer, MAX_QUESTION_CHARS } from '../src/content/aiSummary';

const mockSendMessage = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
    lastError: undefined,
  },
});

describe('buildQAPrompt', () => {
  it('includes the question in the prompt', () => {
    const prompt = buildQAPrompt('What does this do?', 'src/app.ts', 'typescript', 'const x = 1;');
    expect(prompt).toContain('What does this do?');
  });

  it('includes only the filename, not the full directory path', () => {
    const prompt = buildQAPrompt('?', 'src/utils/helper.ts', 'typescript', 'export {}');
    expect(prompt).toContain('helper.ts');
    expect(prompt).not.toContain('src/utils/');
  });

  it('includes the language in the prompt', () => {
    const prompt = buildQAPrompt('?', 'app.py', 'python', 'print("hi")');
    expect(prompt).toContain('python');
  });

  it('includes the file content', () => {
    const prompt = buildQAPrompt('?', 'main.go', 'go', 'package main');
    expect(prompt).toContain('package main');
  });

  it('truncates content exceeding 5000 chars and adds marker', () => {
    const longContent = 'x'.repeat(6000);
    const prompt = buildQAPrompt('?', 'file.ts', 'typescript', longContent);
    expect(prompt).toContain('(truncated)');
    expect(prompt.includes('x'.repeat(5001))).toBe(false);
  });

  it('does not truncate content within the 5000-char limit', () => {
    const content = 'const ok = true;';
    const prompt = buildQAPrompt('?', 'file.ts', 'typescript', content);
    expect(prompt).not.toContain('(truncated)');
    expect(prompt).toContain(content);
  });

  it('truncates question exceeding MAX_QUESTION_CHARS', () => {
    const longQ = 'q'.repeat(MAX_QUESTION_CHARS + 50);
    const prompt = buildQAPrompt(longQ, 'f.ts', 'typescript', 'x');
    expect(prompt).not.toContain('q'.repeat(MAX_QUESTION_CHARS + 1));
    expect(prompt).toContain('q'.repeat(MAX_QUESTION_CHARS));
  });

  it('handles a plain filename with no directory segments', () => {
    const prompt = buildQAPrompt('?', 'Makefile', 'shell', 'all:');
    expect(prompt).toContain('Makefile');
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

  it('returns the answer text on a valid response', async () => {
    respond({ content: [{ text: 'This file handles authentication.' }] });
    expect(await fetchQAAnswer('prompt')).toBe('This file handles authentication.');
  });

  it('trims leading and trailing whitespace from the answer', async () => {
    respond({ content: [{ text: '  Answer here.  ' }] });
    expect(await fetchQAAnswer('prompt')).toBe('Answer here.');
  });

  it('returns null on an error response', async () => {
    respond({ error: 'Missing API key' });
    expect(await fetchQAAnswer('prompt')).toBeNull();
  });

  it('returns null when chrome.runtime.lastError is set', async () => {
    mockSendMessage.mockImplementation((_msg: unknown, cb: (r: unknown) => void) => {
      Object.defineProperty(chrome.runtime, 'lastError', {
        value: { message: 'Extension error' },
        writable: true,
      });
      cb(null);
    });
    expect(await fetchQAAnswer('prompt')).toBeNull();
  });

  it('returns null when content array is absent', async () => {
    respond({});
    expect(await fetchQAAnswer('prompt')).toBeNull();
  });

  it('returns null when text is empty or whitespace-only', async () => {
    respond({ content: [{ text: '   ' }] });
    expect(await fetchQAAnswer('prompt')).toBeNull();
  });

  it('sends GFE_FETCH_QA_ANSWER as the message type', async () => {
    respond({ content: [{ text: 'answer' }] });
    await fetchQAAnswer('my-prompt');
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GFE_FETCH_QA_ANSWER' }),
      expect.any(Function)
    );
  });
});
