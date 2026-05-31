import { beforeEach, describe, expect, it } from 'vitest';
import {
  injectSidebar,
  removeSidebar,
  setModeChangeHandler,
  setSidebarModeToggle,
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

describe('sidebar mode toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders Developer button as active by default', () => {
    injectSidebar();
    const devBtn = document.querySelector('.gfe-mode-dev');
    const bizBtn = document.querySelector('.gfe-mode-biz');
    expect(devBtn?.classList.contains('gfe-mode-active')).toBe(true);
    expect(bizBtn?.classList.contains('gfe-mode-active')).toBe(false);
  });

  it('clicking Business button makes it active and deactivates Developer', () => {
    injectSidebar();
    document.querySelector<HTMLElement>('.gfe-mode-biz')!.click();
    expect(document.querySelector('.gfe-mode-biz')?.classList.contains('gfe-mode-active')).toBe(
      true
    );
    expect(document.querySelector('.gfe-mode-dev')?.classList.contains('gfe-mode-active')).toBe(
      false
    );
    expect(
      document.querySelector('.gfe-mode-toggle')?.classList.contains('gfe-mode-biz-active')
    ).toBe(true);
  });

  it('fires the registered mode-change handler with the new audience', () => {
    injectSidebar();
    let fired: string | null = null;
    setModeChangeHandler((aud) => {
      fired = aud;
    });
    document.querySelector<HTMLElement>('.gfe-mode-biz')!.click();
    expect(fired).toBe('non-technical');
  });

  it('setSidebarModeToggle reflects stored audience in the toggle', () => {
    injectSidebar();
    setSidebarModeToggle('non-technical');
    expect(document.querySelector('.gfe-mode-biz')?.classList.contains('gfe-mode-active')).toBe(
      true
    );
    expect(
      document.querySelector('.gfe-mode-toggle')?.classList.contains('gfe-mode-biz-active')
    ).toBe(true);
    setSidebarModeToggle('developer');
    expect(document.querySelector('.gfe-mode-dev')?.classList.contains('gfe-mode-active')).toBe(
      true
    );
    expect(
      document.querySelector('.gfe-mode-toggle')?.classList.contains('gfe-mode-biz-active')
    ).toBe(false);
  });

  it('mode toggle persists across updateSidebar calls', () => {
    injectSidebar();
    document.querySelector<HTMLElement>('.gfe-mode-biz')!.click();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, () => {});
    expect(document.querySelector('.gfe-mode-biz')?.classList.contains('gfe-mode-active')).toBe(
      true
    );
  });
});

describe('sidebar accordion', () => {
  const noop = () => {};

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('Summary accordion is open by default', () => {
    injectSidebar();
    updateSidebar(
      { summary: 'Handles auth.', keyPoints: ['Validates JWT'], complexity: 'low' },
      noop
    );
    const accItems = document.querySelectorAll('.gfe-acc');
    expect(accItems[0]?.classList.contains('gfe-acc-open')).toBe(true);
  });

  it('Key Points accordion is closed by default', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: ['point one'], complexity: 'low' }, noop);
    const accItems = document.querySelectorAll('.gfe-acc');
    expect(accItems[1]?.classList.contains('gfe-acc-open')).toBe(false);
  });

  it('clicking a closed accordion header opens it', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: ['point one'], complexity: 'low' }, noop);
    const kpAcc = document.querySelectorAll('.gfe-acc')[1] as HTMLElement;
    (kpAcc.querySelector('.gfe-acc-head') as HTMLElement).click();
    expect(kpAcc.classList.contains('gfe-acc-open')).toBe(true);
  });

  it('clicking an open accordion header closes it', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, noop);
    const sumAcc = document.querySelector('.gfe-acc') as HTMLElement;
    (sumAcc.querySelector('.gfe-acc-head') as HTMLElement).click();
    expect(sumAcc.classList.contains('gfe-acc-open')).toBe(false);
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

  it('Find Bugs button fills the Q&A input', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, noop);
    const findBugsBtn = Array.from(document.querySelectorAll<HTMLElement>('.gfe-quick-btn')).find(
      (b) => b.textContent?.includes('Find Bugs')
    )!;
    findBugsBtn.click();
    const input = document.querySelector<HTMLTextAreaElement>('.gfe-qa-input');
    expect(input?.value).toBe('Find bugs and issues in this file');
  });

  it('Security Scan button fills the Q&A input', () => {
    injectSidebar();
    updateSidebar({ summary: 'x', keyPoints: [], complexity: 'low' }, noop);
    const secBtn = Array.from(document.querySelectorAll<HTMLElement>('.gfe-quick-btn')).find((b) =>
      b.textContent?.includes('Security Scan')
    )!;
    secBtn.click();
    const input = document.querySelector<HTMLTextAreaElement>('.gfe-qa-input');
    expect(input?.value).toBe('Are there any security vulnerabilities in this file?');
  });
});
