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
});
