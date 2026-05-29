import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from '../src/content/refParser';
import type { ResourceChange } from '../src/content/types';

function makeChange(id: string, attrValues: string[] = []): ResourceChange {
  const [type, name] = id.split('.');
  return {
    id,
    type,
    name,
    action: 'update',
    filePath: 'main.tf',
    changes: attrValues.map((v) => ({ attribute: 'some_attr', newValue: v, isSensitive: false })),
    riskProfile: { level: 'low', reasons: [], isDestructive: false },
  };
}

describe('refParser.buildDependencyGraph', () => {
  describe('empty input', () => {
    it('returns an empty map', () => {
      const graph = buildDependencyGraph([]);
      expect(graph.size).toBe(0);
    });
  });

  describe('no cross-references', () => {
    it('each node has an empty dependency set', () => {
      const changes = [makeChange('aws_iam_role.api'), makeChange('aws_s3_bucket.data')];
      const graph = buildDependencyGraph(changes);
      expect(graph.get('aws_iam_role.api')?.size).toBe(0);
      expect(graph.get('aws_s3_bucket.data')?.size).toBe(0);
    });
  });

  describe('direct reference', () => {
    it('detects a reference from one resource to another', () => {
      const changes = [
        makeChange('aws_iam_role.api', ['aws_iam_policy.admin.arn']),
        makeChange('aws_iam_policy.admin'),
      ];
      const graph = buildDependencyGraph(changes);
      expect(graph.get('aws_iam_role.api')?.has('aws_iam_policy.admin')).toBe(true);
      expect(graph.get('aws_iam_policy.admin')?.size).toBe(0);
    });

    it('reference is detected when id appears mid-value', () => {
      const changes = [
        makeChange('aws_iam_role.api', [
          '["${aws_iam_policy.admin.arn}", "arn:aws:iam::123:policy/extra"]',
        ]),
        makeChange('aws_iam_policy.admin'),
      ];
      const graph = buildDependencyGraph(changes);
      expect(graph.get('aws_iam_role.api')?.has('aws_iam_policy.admin')).toBe(true);
    });
  });

  describe('word boundary — no prefix false positives', () => {
    it('does not falsely match a shorter id when value references the longer id', () => {
      // "aws_s3_bucket.data_backup.id" contains "aws_s3_bucket.data" as a prefix.
      // The shorter id should NOT be detected as a dependency.
      const changes = [
        makeChange('aws_iam_role.api', ['aws_s3_bucket.data_backup.id']),
        makeChange('aws_s3_bucket.data'),
        makeChange('aws_s3_bucket.data_backup'),
      ];
      const graph = buildDependencyGraph(changes);
      expect(graph.get('aws_iam_role.api')?.has('aws_s3_bucket.data')).toBe(false);
      expect(graph.get('aws_iam_role.api')?.has('aws_s3_bucket.data_backup')).toBe(true);
    });

    it('does match the longer id correctly when it appears with a word boundary', () => {
      const changes = [
        makeChange('aws_iam_role.api', ['aws_s3_bucket.data_backup.arn']),
        makeChange('aws_s3_bucket.data_backup'),
      ];
      const graph = buildDependencyGraph(changes);
      expect(graph.get('aws_iam_role.api')?.has('aws_s3_bucket.data_backup')).toBe(true);
    });
  });

  describe('multiple dependencies', () => {
    it('captures all referenced ids for a single resource', () => {
      const changes = [
        makeChange('aws_iam_role.api', ['aws_iam_policy.admin.arn', 'aws_s3_bucket.data.id']),
        makeChange('aws_iam_policy.admin'),
        makeChange('aws_s3_bucket.data'),
      ];
      const graph = buildDependencyGraph(changes);
      const deps = graph.get('aws_iam_role.api');
      expect(deps?.has('aws_iam_policy.admin')).toBe(true);
      expect(deps?.has('aws_s3_bucket.data')).toBe(true);
      expect(deps?.size).toBe(2);
    });
  });

  describe('bidirectional references', () => {
    it('records dependencies in both directions independently', () => {
      const changes = [
        makeChange('aws_iam_role.api', ['aws_iam_policy.admin.arn']),
        makeChange('aws_iam_policy.admin', ['aws_iam_role.api.id']),
      ];
      const graph = buildDependencyGraph(changes);
      expect(graph.get('aws_iam_role.api')?.has('aws_iam_policy.admin')).toBe(true);
      expect(graph.get('aws_iam_policy.admin')?.has('aws_iam_role.api')).toBe(true);
    });
  });

  describe('self-reference prevention', () => {
    it('does not add a resource as its own dependency', () => {
      const changes = [makeChange('aws_iam_role.api', ['aws_iam_role.api.name'])];
      const graph = buildDependencyGraph(changes);
      expect(graph.get('aws_iam_role.api')?.has('aws_iam_role.api')).toBe(false);
    });
  });

  describe('oldValue is ignored', () => {
    it('does not count references that only appear in removed lines', () => {
      const [type, name] = 'aws_iam_role.api'.split('.');
      const changes: ResourceChange[] = [
        {
          id: 'aws_iam_role.api',
          type,
          name,
          action: 'update',
          filePath: 'main.tf',
          changes: [
            { attribute: 'policy', oldValue: 'aws_iam_policy.admin.arn', isSensitive: false },
          ],
          riskProfile: { level: 'low', reasons: [], isDestructive: false },
        },
        makeChange('aws_iam_policy.admin'),
      ];
      const graph = buildDependencyGraph(changes);
      expect(graph.get('aws_iam_role.api')?.has('aws_iam_policy.admin')).toBe(false);
    });
  });

  describe('all resources get an entry', () => {
    it('every input id appears as a key in the graph', () => {
      const changes = [makeChange('aws_iam_role.api'), makeChange('aws_s3_bucket.data')];
      const graph = buildDependencyGraph(changes);
      expect(graph.has('aws_iam_role.api')).toBe(true);
      expect(graph.has('aws_s3_bucket.data')).toBe(true);
    });
  });
});
