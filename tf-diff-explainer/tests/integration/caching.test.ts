import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ResourceChange } from '../../src/content/types';

// Minimal in-memory chrome.storage.session mock
const sessionStore: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    session: {
      get: vi.fn(async (key: string) => ({ [key]: sessionStore[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(sessionStore, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete sessionStore[key];
      }),
    },
  },
});

// Import after stubbing so the module sees the mock
const { getCachedAnalysis, setCachedAnalysis, clearCachedAnalysis } =
  await import('../../src/utils/storage');

function makeChange(id: string): ResourceChange {
  const [type, name] = id.split('.');
  return {
    id,
    type,
    name,
    action: 'update',
    filePath: 'main.tf',
    changes: [],
    riskProfile: { level: 'low', reasons: [], isDestructive: false },
  };
}

describe('analysis caching', () => {
  beforeEach(() => {
    for (const key of Object.keys(sessionStore)) delete sessionStore[key];
    vi.clearAllMocks();
  });

  describe('getCachedAnalysis', () => {
    it('returns null on cache miss', async () => {
      const result = await getCachedAnalysis('https://github.com/org/repo/pull/1');
      expect(result).toBeNull();
    });

    it('returns cached changes after setCachedAnalysis', async () => {
      const url = 'https://github.com/org/repo/pull/1';
      const changes = [makeChange('aws_iam_role.api')];
      const graph = new Map([['aws_iam_role.api', new Set<string>()]]);
      await setCachedAnalysis(url, changes, graph);

      const cached = await getCachedAnalysis(url);
      expect(cached).not.toBeNull();
      expect(cached!.changes).toEqual(changes);
    });

    it('restores DependencyGraph with correct Map and Set structure', async () => {
      const url = 'https://github.com/org/repo/pull/2';
      const changes = [makeChange('aws_iam_role.api'), makeChange('aws_s3_bucket.data')];
      const graph = new Map([
        ['aws_iam_role.api', new Set(['aws_s3_bucket.data'])],
        ['aws_s3_bucket.data', new Set<string>()],
      ]);
      await setCachedAnalysis(url, changes, graph);

      const cached = await getCachedAnalysis(url);
      expect(cached!.graph).toBeInstanceOf(Map);
      expect(cached!.graph.get('aws_iam_role.api')).toBeInstanceOf(Set);
      expect(cached!.graph.get('aws_iam_role.api')!.has('aws_s3_bucket.data')).toBe(true);
      expect(cached!.graph.get('aws_s3_bucket.data')!.size).toBe(0);
    });

    it('stores different URLs independently', async () => {
      const url1 = 'https://github.com/org/repo/pull/1';
      const url2 = 'https://github.com/org/repo/pull/2';
      const changes1 = [makeChange('aws_iam_role.api')];
      const changes2 = [makeChange('aws_s3_bucket.data')];
      await setCachedAnalysis(url1, changes1, new Map());
      await setCachedAnalysis(url2, changes2, new Map());

      const cached1 = await getCachedAnalysis(url1);
      const cached2 = await getCachedAnalysis(url2);
      expect(cached1!.changes[0].id).toBe('aws_iam_role.api');
      expect(cached2!.changes[0].id).toBe('aws_s3_bucket.data');
    });
  });

  describe('clearCachedAnalysis', () => {
    it('removes the entry so getCachedAnalysis returns null', async () => {
      const url = 'https://github.com/org/repo/pull/3';
      await setCachedAnalysis(url, [makeChange('aws_iam_role.api')], new Map());
      await clearCachedAnalysis(url);

      const result = await getCachedAnalysis(url);
      expect(result).toBeNull();
    });
  });
});
