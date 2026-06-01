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
});

describe('sidebar tabs', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('Summary tab is active by default', () => {
    injectSidebar();
    expect(document.querySelector('[data-tab="summary"]')?.classList.contains('gfe-tab-on')).toBe(
      true
    );
  });

  it('Summary tabview visible by default', () => {
    injectSidebar();
    const view = document.querySelector<HTMLElement>('[data-tabview="summary"]');
    expect(view?.style.display).not.toBe('none');
  });

  it('Files tabview hidden by default', () => {
    injectSidebar();
    expect(document.querySelector<HTMLElement>('[data-tabview="files"]')?.style.display).toBe(
      'none'
    );
  });

  it('clicking Files tab activates it', () => {
    injectSidebar();
    const panel = document.getElementById('git-file-explainer-sidebar')!;
    (panel.querySelector<HTMLElement>('[data-tab="files"]') as HTMLElement).click();
    expect(document.querySelector('[data-tab="files"]')?.classList.contains('gfe-tab-on')).toBe(
      true
    );
    expect(document.querySelector('[data-tab="summary"]')?.classList.contains('gfe-tab-on')).toBe(
      false
    );
  });

  it('clicking Files tab shows files tabview', () => {
    injectSidebar();
    const panel = document.getElementById('git-file-explainer-sidebar')!;
    (panel.querySelector<HTMLElement>('[data-tab="files"]') as HTMLElement).click();
    expect(document.querySelector<HTMLElement>('[data-tabview="files"]')?.style.display).not.toBe(
      'none'
    );
  });
});

describe('sidebar quick actions', () => {
  const noop = () => {};

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders four quick action buttons', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, noop);
    expect(document.querySelectorAll('.gfe-quick-btn').length).toBe(4);
  });

  it('Find Bugs button fills and submits the Q&A input', () => {
    injectSidebar();
    let asked: string | null = null;
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, (question) => {
      asked = question;
    });
    const findBugsBtn = Array.from(document.querySelectorAll<HTMLElement>('.gfe-quick-btn')).find(
      (b) => b.textContent?.includes('Find Bugs')
    )!;
    findBugsBtn.click();
    const input = document.querySelector<HTMLTextAreaElement>('.gfe-qa-input');
    expect(input?.value).toBe('');
    expect(asked).toBe('Find bugs and issues in this file');
    expect(document.querySelector('.gfe-user-bubble')?.textContent).toBe(
      'Find bugs and issues in this file'
    );
  });

  it('Security Scan button fills and submits the Q&A input', () => {
    injectSidebar();
    let asked: string | null = null;
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, (question) => {
      asked = question;
    });
    const secBtn = Array.from(document.querySelectorAll<HTMLElement>('.gfe-quick-btn')).find((b) =>
      b.textContent?.includes('Security Scan')
    )!;
    secBtn.click();
    const input = document.querySelector<HTMLTextAreaElement>('.gfe-qa-input');
    expect(input?.value).toBe('');
    expect(asked).toBe('Are there any security vulnerabilities in this file?');
    expect(document.querySelector('.gfe-user-bubble')?.textContent).toBe(
      'Are there any security vulnerabilities in this file?'
    );
  });
});
