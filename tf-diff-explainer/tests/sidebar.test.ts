// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  injectSidebar,
  removeSidebar,
  showSetupPanel,
  showAnalyzing,
  showRiskMap,
  showAIReview,
} from '../src/content/sidebar/index';
import type { ResourceChange, AISummaryResult } from '../src/content/types';

function makeChange(overrides: Partial<ResourceChange> = {}): ResourceChange {
  return {
    id: 'aws_s3_bucket.data',
    type: 'aws_s3_bucket',
    name: 'data',
    action: 'update',
    filePath: 'infra/storage.tf',
    changes: [
      { attribute: 'acl', oldValue: '"private"', newValue: '"public-read"', isSensitive: false },
    ],
    riskProfile: { level: 'high', reasons: ['Bucket made public'], isDestructive: false },
    ...overrides,
  };
}

const AI_RESULT: AISummaryResult = {
  summary: 'This PR makes the S3 bucket public.',
  risks: ['[HIGH] data bucket is made public — restrict ACL.', '[MEDIUM] broad permissions set.'],
  rollback: ['Revert the acl attribute', 'Run terraform apply'],
  prDescription: '## Summary\nMakes S3 public.',
};

describe('sidebar.injectSidebar / removeSidebar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('injects sidebar into body', () => {
    injectSidebar();
    expect(document.getElementById('tf-diff-explainer-sidebar')).not.toBeNull();
  });

  it('does not inject a second sidebar', () => {
    injectSidebar();
    injectSidebar();
    expect(document.querySelectorAll('#tf-diff-explainer-sidebar')).toHaveLength(1);
  });

  it('removeSidebar removes the element', () => {
    injectSidebar();
    removeSidebar();
    expect(document.getElementById('tf-diff-explainer-sidebar')).toBeNull();
  });

  it('removeSidebar is safe when sidebar not present', () => {
    expect(() => removeSidebar()).not.toThrow();
  });
});

describe('sidebar.showSetupPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    injectSidebar();
  });

  it('renders API key input', () => {
    showSetupPanel(
      'github.com',
      async () => {},
      async () => {},
      null,
      true
    );
    expect(document.querySelector('#tfe-setup-api-key')).not.toBeNull();
  });

  it('renders Save button', () => {
    showSetupPanel(
      'github.com',
      async () => {},
      async () => {},
      null,
      true
    );
    expect(document.querySelector('.tfe-setup-save-btn')).not.toBeNull();
  });

  it('renders site toggle', () => {
    showSetupPanel(
      'github.com',
      async () => {},
      async () => {},
      null,
      true
    );
    expect(document.querySelector('#tfe-setup-site-toggle')).not.toBeNull();
  });

  it('shows host name in body', () => {
    showSetupPanel(
      'github.com/org/repo',
      async () => {},
      async () => {},
      null,
      true
    );
    expect(document.querySelector('.tfe-body')!.textContent).toContain('github.com/org/repo');
  });

  it('toggle reflects siteEnabled=false', () => {
    showSetupPanel(
      'github.com',
      async () => {},
      async () => {},
      null,
      false
    );
    expect(document.querySelector<HTMLInputElement>('#tfe-setup-site-toggle')!.checked).toBe(false);
  });

  it('toggle reflects siteEnabled=true', () => {
    showSetupPanel(
      'github.com',
      async () => {},
      async () => {},
      null,
      true
    );
    expect(document.querySelector<HTMLInputElement>('#tfe-setup-site-toggle')!.checked).toBe(true);
  });

  it('shows onboarding banner when no current key', () => {
    showSetupPanel(
      'github.com',
      async () => {},
      async () => {},
      null,
      true
    );
    expect(document.querySelector('.tfe-setup-banner')).not.toBeNull();
  });

  it('hides onboarding banner when key already set', () => {
    showSetupPanel(
      'github.com',
      async () => {},
      async () => {},
      'sk-ant-test',
      true
    );
    expect(document.querySelector('.tfe-setup-banner')).toBeNull();
  });

  it('calls onSave with trimmed key on Save click', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    showSetupPanel('github.com', onSave, async () => {}, null, true);
    document.querySelector<HTMLInputElement>('#tfe-setup-api-key')!.value = '  sk-ant-test  ';
    document.querySelector<HTMLButtonElement>('.tfe-setup-save-btn')!.click();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledWith('sk-ant-test');
  });

  it('calls onToggle when toggle changes', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    showSetupPanel('github.com', async () => {}, onToggle, null, false);
    const toggle = document.querySelector<HTMLInputElement>('#tfe-setup-site-toggle')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    await Promise.resolve();
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

describe('sidebar.showAnalyzing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    injectSidebar();
  });

  it('renders ANALYZING PLAN label', () => {
    showAnalyzing();
    expect(document.querySelector('.tfe-body')!.textContent).toContain('ANALYZING PLAN');
  });

  it('renders skeleton lines', () => {
    showAnalyzing();
    expect(document.querySelectorAll('.tfe-skeleton-line').length).toBeGreaterThan(0);
  });

  it('renders compact header', () => {
    showAnalyzing();
    expect(document.querySelector('.tfe-header-compact')).not.toBeNull();
  });
});

describe('sidebar.showRiskMap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    injectSidebar();
  });

  it('renders a card per change', () => {
    showRiskMap([makeChange(), makeChange({ id: 'aws_s3_bucket.logs', name: 'logs' })]);
    expect(document.querySelectorAll('.tfe-card')).toHaveLength(2);
  });

  it('renders resource name in card', () => {
    showRiskMap([makeChange()]);
    expect(document.querySelector('.tfe-card-name')!.textContent).toBe('data');
  });

  it('renders resource type in card', () => {
    showRiskMap([makeChange()]);
    expect(document.querySelector('.tfe-card-type')!.textContent).toBe('aws_s3_bucket');
  });

  it('renders file path in card', () => {
    showRiskMap([makeChange()]);
    expect(document.querySelector('.tfe-card-file')!.textContent).toBe('infra/storage.tf');
  });

  it('renders diff attribute line for update', () => {
    showRiskMap([makeChange()]);
    const diffLine = document.querySelector('.tfe-diff-update')!;
    expect(diffLine.textContent).toContain('acl');
    expect(diffLine.textContent).toContain('→');
  });

  it('renders risk reason in card', () => {
    showRiskMap([makeChange()]);
    expect(document.querySelector('.tfe-card-reason-text')!.textContent).toBe('Bucket made public');
  });

  it('card has correct risk class', () => {
    showRiskMap([makeChange()]);
    expect(document.querySelector('.tfe-card')!.classList.contains('tfe-risk-high')).toBe(true);
  });

  it('card has action badge', () => {
    showRiskMap([makeChange()]);
    expect(document.querySelector('.tfe-action-update')).not.toBeNull();
  });

  it('renders empty state for no changes', () => {
    showRiskMap([]);
    expect(document.querySelector('.tfe-empty')).not.toBeNull();
  });

  it('renders risk bar for non-empty changes', () => {
    showRiskMap([makeChange()]);
    expect(document.querySelector('.tfe-risk-bar-wrap')).not.toBeNull();
  });

  it('renders section label RISK ANALYSIS', () => {
    showRiskMap([makeChange()]);
    expect(document.querySelector('.tfe-section-label')!.textContent).toBe('RISK ANALYSIS');
  });

  it('diff line for create shows + prefix', () => {
    const c = makeChange({
      action: 'create',
      changes: [{ attribute: 'bucket', newValue: '"my-bucket"', isSensitive: false }],
    });
    showRiskMap([c]);
    expect(document.querySelector('.tfe-diff-add')).not.toBeNull();
  });

  it('diff line for delete shows - prefix', () => {
    const c = makeChange({
      action: 'delete',
      changes: [{ attribute: 'bucket', oldValue: '"my-bucket"', isSensitive: false }],
    });
    showRiskMap([c]);
    expect(document.querySelector('.tfe-diff-delete')).not.toBeNull();
  });

  it('sensitive attributes are not rendered in diff lines', () => {
    const c = makeChange({
      changes: [
        { attribute: 'password', oldValue: 'secret', newValue: 'new-secret', isSensitive: true },
      ],
    });
    showRiskMap([c]);
    const body = document.querySelector('.tfe-body')!;
    expect(body.textContent).not.toContain('password');
  });
});

describe('sidebar.showAIReview', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    injectSidebar();
  });

  it('renders loading skeleton', () => {
    showAIReview([makeChange()], 'loading');
    expect(document.querySelectorAll('.tfe-skeleton-line').length).toBeGreaterThan(0);
  });

  it('renders no-key state', () => {
    showAIReview([makeChange()], 'no-key');
    expect(document.querySelector('.tfe-ai-cta')!.textContent).toContain('API key');
  });

  it('renders error state', () => {
    showAIReview([makeChange()], 'error');
    expect(document.querySelector('.tfe-ai-error')!.textContent).toContain('failed');
  });

  it('renders AI summary text', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelector('.tfe-ai-summary')!.textContent).toBe(
      'This PR makes the S3 bucket public.'
    );
  });

  it('renders risk items with inline badges', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelectorAll('.tfe-risk-badge')).toHaveLength(2);
  });

  it('HIGH prefix maps to tfe-risk-badge-high', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelector('.tfe-risk-badge-high')).not.toBeNull();
  });

  it('MEDIUM prefix maps to tfe-risk-badge-medium', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelector('.tfe-risk-badge-medium')).not.toBeNull();
  });

  it('strips [HIGH] prefix from risk item text', () => {
    showAIReview([makeChange()], AI_RESULT);
    const itemTexts = [...document.querySelectorAll('.tfe-risk-item-text')].map(
      (el) => el.textContent
    );
    expect(itemTexts[0]).not.toContain('[HIGH]');
    expect(itemTexts[0]).toContain('data bucket');
  });

  it('renders rollback checklist with checkboxes', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelectorAll('.tfe-ai-rollback-check')).toHaveLength(2);
  });

  it('renders PR description text', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelector('.tfe-ai-pr-desc')!.textContent).toContain('Makes S3 public.');
  });

  it('renders Copy button for PR description', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelector('.tfe-ai-copy-btn')).not.toBeNull();
  });

  it('renders AI REVIEW section label', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelector('.tfe-section-label')!.textContent).toBe('AI REVIEW');
  });

  it('renders risk bar when changes provided', () => {
    showAIReview([makeChange()], AI_RESULT);
    expect(document.querySelector('.tfe-risk-bar-wrap')).not.toBeNull();
  });
});
