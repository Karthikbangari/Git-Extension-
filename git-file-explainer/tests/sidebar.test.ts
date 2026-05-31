import { beforeEach, describe, expect, it } from 'vitest';
import {
  injectSidebar,
  removeSidebar,
  updateQAAnswer,
  updateSidebar,
} from '../src/content/sidebar';

describe('sidebar Q&A UI', () => {
  const noop = () => {};

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a Q&A input after a summary result', () => {
    injectSidebar();
    updateSidebar(
      {
        summary: 'Explains routing.',
        keyPoints: ['Defines routes'],
        complexity: 'medium',
      },
      noop
    );

    expect(document.querySelector('.gfe-qa-section')).not.toBeNull();
    expect(document.querySelector<HTMLTextAreaElement>('.gfe-qa-input')?.maxLength).toBe(280);
    expect(document.querySelector('.gfe-qa-btn')?.textContent).toBe('Ask');
  });

  it('does not render Q&A controls for loading state', () => {
    injectSidebar();
    updateSidebar('loading');
    expect(document.querySelector('.gfe-qa-section')).toBeNull();
  });

  it('does not render Q&A controls for no-key state', () => {
    injectSidebar();
    updateSidebar('no-key');
    expect(document.querySelector('.gfe-qa-section')).toBeNull();
  });

  it('renders a loading answer state', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, noop);
    updateQAAnswer('loading');
    expect(document.querySelector('.gfe-qa-thinking')?.textContent).toBe('Thinking…');
  });

  it('renders an error answer state', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, noop);
    updateQAAnswer('error');
    expect(document.querySelector('.gfe-qa-error-text')?.textContent).toBe(
      'Could not get an answer. Please try again.'
    );
  });

  it('renders answer text without interpreting markup', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, noop);
    updateQAAnswer('<strong>answer</strong>');
    expect(document.querySelector('.gfe-qa-text')?.textContent).toBe('<strong>answer</strong>');
    expect(document.querySelector('.gfe-qa-answer strong')).toBeNull();
  });

  it('replaces a rendered answer with the next loading state', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, noop);
    updateQAAnswer('Answer text');
    updateQAAnswer('loading');
    expect(document.querySelector('.gfe-qa-answer')?.textContent).toBe('Thinking…');
  });

  it('removes the sidebar from the document', () => {
    injectSidebar();
    removeSidebar();
    expect(document.getElementById('git-file-explainer-sidebar')).toBeNull();
  });

  it('renders token chip in no-key state when contentChars provided', () => {
    injectSidebar();
    updateSidebar('no-key', undefined, false, undefined, undefined, 4000);
    const chip = document.querySelector('.gfe-token-chip');
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toBe('~1,000 tokens');
  });

  it('does not render token chip in no-key state when contentChars absent', () => {
    injectSidebar();
    updateSidebar('no-key');
    expect(document.querySelector('.gfe-token-chip')).toBeNull();
  });

  it('includes token count in truncated notice when contentChars provided', () => {
    injectSidebar();
    updateSidebar('no-key', undefined, true, 800, undefined, 12000);
    const notice = document.querySelector('.gfe-truncated-notice');
    expect(notice?.textContent).toContain('3,000 tokens sent');
  });

  it('renders share button after summary result', () => {
    injectSidebar();
    updateSidebar(
      { summary: 'Does routing.', keyPoints: ['Defines routes'], complexity: 'low' },
      noop
    );
    const btn = document.querySelector('.gfe-share-btn');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe('↗ Open in Claude.ai');
  });

  it('does not render share button for no-key state', () => {
    injectSidebar();
    updateSidebar('no-key');
    expect(document.querySelector('.gfe-share-btn')).toBeNull();
  });
});
