import { describe, it, expect } from 'vitest';
import { classifyRisks } from '../src/content/riskClassifier';
import type { ResourceChange } from '../src/content/types';

function makeChange(overrides: Partial<ResourceChange> = {}): ResourceChange {
  return {
    id: 'aws_resource.example',
    type: 'aws_resource',
    name: 'example',
    action: 'update',
    filePath: 'main.tf',
    changes: [],
    riskProfile: { level: 'low', reasons: [], isDestructive: false },
    ...overrides,
  };
}

describe('riskClassifier.classifyRisks', () => {
  describe('IAM wildcard action', () => {
    it('scores HIGH when actions = ["*"]', () => {
      const [result] = classifyRisks([
        makeChange({ changes: [{ attribute: 'actions', newValue: '["*"]', isSensitive: false }] }),
      ]);
      expect(result.riskProfile.level).toBe('high');
      expect(result.riskProfile.reasons).toContain('IAM wildcard action');
    });

    it('does not trigger for specific actions', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [{ attribute: 'actions', newValue: '["s3:GetObject"]', isSensitive: false }],
        }),
      ]);
      expect(result.riskProfile.reasons).not.toContain('IAM wildcard action');
    });

    it('does not trigger when wildcard is only in oldValue (removed line)', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [{ attribute: 'actions', oldValue: '["*"]', isSensitive: false }],
        }),
      ]);
      expect(result.riskProfile.reasons).not.toContain('IAM wildcard action');
    });
  });

  describe('IAM wildcard principal', () => {
    it('scores HIGH when identifiers = ["*"]', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [{ attribute: 'identifiers', newValue: '["*"]', isSensitive: false }],
        }),
      ]);
      expect(result.riskProfile.level).toBe('high');
      expect(result.riskProfile.reasons).toContain('IAM wildcard principal');
    });

    it('scores HIGH when principal = "*"', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [{ attribute: 'principal', newValue: '"*"', isSensitive: false }],
        }),
      ]);
      expect(result.riskProfile.reasons).toContain('IAM wildcard principal');
    });

    it('does not trigger for specific principals', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [
            {
              attribute: 'identifiers',
              newValue: '["arn:aws:iam::123456789012:root"]',
              isSensitive: false,
            },
          ],
        }),
      ]);
      expect(result.riskProfile.reasons).not.toContain('IAM wildcard principal');
    });
  });

  describe('Open security group ingress', () => {
    it('scores HIGH for 0.0.0.0/0 in ingress block', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [
            { attribute: 'ingress.cidr_blocks', newValue: '["0.0.0.0/0"]', isSensitive: false },
          ],
        }),
      ]);
      expect(result.riskProfile.level).toBe('high');
      expect(result.riskProfile.reasons).toContain('Open security group ingress (0.0.0.0/0)');
    });

    it('does not trigger for restricted CIDR in ingress', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [
            { attribute: 'ingress.cidr_blocks', newValue: '["10.0.0.0/8"]', isSensitive: false },
          ],
        }),
      ]);
      expect(result.riskProfile.reasons).not.toContain('Open security group ingress (0.0.0.0/0)');
    });

    it('does not trigger ingress rule for 0.0.0.0/0 in egress', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [
            { attribute: 'egress.cidr_blocks', newValue: '["0.0.0.0/0"]', isSensitive: false },
          ],
        }),
      ]);
      expect(result.riskProfile.reasons).not.toContain('Open security group ingress (0.0.0.0/0)');
    });
  });

  describe('Open security group egress', () => {
    it('scores MEDIUM (not HIGH) for 0.0.0.0/0 in egress block', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [
            { attribute: 'egress.cidr_blocks', newValue: '["0.0.0.0/0"]', isSensitive: false },
          ],
        }),
      ]);
      expect(result.riskProfile.level).toBe('medium');
      expect(result.riskProfile.reasons).toContain('Open security group egress (0.0.0.0/0)');
    });

    it('does not trigger for restricted CIDR in egress', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [
            {
              attribute: 'egress.cidr_blocks',
              newValue: '["10.0.0.0/8"]',
              isSensitive: false,
            },
          ],
        }),
      ]);
      expect(result.riskProfile.reasons).not.toContain('Open security group egress (0.0.0.0/0)');
    });
  });

  describe('force_destroy', () => {
    it('scores HIGH when force_destroy = true', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [{ attribute: 'force_destroy', newValue: 'true', isSensitive: false }],
        }),
      ]);
      expect(result.riskProfile.level).toBe('high');
      expect(result.riskProfile.reasons).toContain('force_destroy enabled');
    });

    it('does not trigger when force_destroy = false', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [{ attribute: 'force_destroy', newValue: 'false', isSensitive: false }],
        }),
      ]);
      expect(result.riskProfile.reasons).not.toContain('force_destroy enabled');
    });

    it('does not trigger for unrelated attributes containing "destroy"', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [{ attribute: 'prevent_destroy', newValue: 'true', isSensitive: false }],
        }),
      ]);
      expect(result.riskProfile.reasons).not.toContain('force_destroy enabled');
    });
  });

  describe('Resource deletion', () => {
    it('scores HIGH for action = delete', () => {
      const [result] = classifyRisks([makeChange({ action: 'delete' })]);
      expect(result.riskProfile.level).toBe('high');
      expect(result.riskProfile.reasons).toContain('Resource deletion');
    });

    it('sets isDestructive = true for deletions', () => {
      const [result] = classifyRisks([makeChange({ action: 'delete' })]);
      expect(result.riskProfile.isDestructive).toBe(true);
    });

    it('does not trigger for action = create', () => {
      const [result] = classifyRisks([makeChange({ action: 'create' })]);
      expect(result.riskProfile.reasons).not.toContain('Resource deletion');
    });
  });

  describe('Multiple rules', () => {
    it('accumulates both IAM wildcard reasons and keeps HIGH', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [
            { attribute: 'actions', newValue: '["*"]', isSensitive: false },
            { attribute: 'identifiers', newValue: '["*"]', isSensitive: false },
          ],
        }),
      ]);
      expect(result.riskProfile.level).toBe('high');
      expect(result.riskProfile.reasons).toContain('IAM wildcard action');
      expect(result.riskProfile.reasons).toContain('IAM wildcard principal');
    });

    it('HIGH overrides MEDIUM when both egress and force_destroy match', () => {
      const [result] = classifyRisks([
        makeChange({
          changes: [
            { attribute: 'egress.cidr_blocks', newValue: '["0.0.0.0/0"]', isSensitive: false },
            { attribute: 'force_destroy', newValue: 'true', isSensitive: false },
          ],
        }),
      ]);
      expect(result.riskProfile.level).toBe('high');
    });
  });

  describe('Default — no rules match', () => {
    it('returns LOW with empty reasons', () => {
      const [result] = classifyRisks([makeChange()]);
      expect(result.riskProfile.level).toBe('low');
      expect(result.riskProfile.reasons).toHaveLength(0);
      expect(result.riskProfile.isDestructive).toBe(false);
    });
  });

  describe('Empty input', () => {
    it('returns empty array', () => {
      expect(classifyRisks([])).toEqual([]);
    });
  });
});
