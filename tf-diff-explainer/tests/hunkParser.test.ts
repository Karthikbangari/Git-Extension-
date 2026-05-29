import { describe, it, expect, afterEach, vi } from 'vitest';
import { extractChanges, parseDiff } from '../src/content/hunkParser';
import type { FileRecord } from '../src/content/hunkParser';

// --- fixtures ---

const newIAMPolicy: FileRecord[] = [
  {
    filePath: 'modules/iam/main.tf',
    lines: [
      { text: 'resource "aws_iam_policy" "admin" {', kind: 'added' },
      { text: '  name    = "admin-policy"', kind: 'added' },
      { text: '  actions = ["*"]', kind: 'added' },
      { text: '}', kind: 'added' },
    ],
  },
];

const deletedBucket: FileRecord[] = [
  {
    filePath: 'main.tf',
    lines: [
      { text: 'resource "aws_s3_bucket" "old" {', kind: 'removed' },
      { text: '  bucket = "my-old-bucket"', kind: 'removed' },
      { text: '}', kind: 'removed' },
    ],
  },
];

const updatedSGIngress: FileRecord[] = [
  {
    filePath: 'security.tf',
    lines: [
      { text: 'resource "aws_security_group" "web" {', kind: 'context' },
      { text: '  ingress {', kind: 'context' },
      { text: '    cidr_blocks = ["10.0.0.0/8"]', kind: 'removed' },
      { text: '    cidr_blocks = ["0.0.0.0/0"]', kind: 'added' },
      { text: '  }', kind: 'context' },
      { text: '}', kind: 'context' },
    ],
  },
];

const multiResource: FileRecord[] = [
  {
    filePath: 'main.tf',
    lines: [
      { text: 'resource "aws_s3_bucket" "data" {', kind: 'added' },
      { text: '  force_destroy = true', kind: 'added' },
      { text: '}', kind: 'added' },
      { text: 'resource "aws_iam_role" "api" {', kind: 'added' },
      { text: '  name = "api-role"', kind: 'added' },
      { text: '}', kind: 'added' },
    ],
  },
];

const noHeaderWithChanges: FileRecord[] = [
  {
    filePath: 'vars.tf',
    lines: [{ text: '  force_destroy = true', kind: 'added' }],
  },
];

const emptyFile: FileRecord[] = [
  {
    filePath: 'unchanged.tf',
    lines: [],
  },
];

const gitlabShape: FileRecord[] = [
  {
    filePath: 'modules/ec2/main.tf',
    lines: [
      { text: 'resource "aws_instance" "web" {', kind: 'added' },
      { text: '  ami           = "ami-0c55b159cbfafe1f0"', kind: 'added' },
      { text: '  instance_type = "t3.micro"', kind: 'added' },
      { text: '}', kind: 'added' },
    ],
  },
];

const replacedResource: FileRecord[] = [
  {
    filePath: 'main.tf',
    lines: [
      { text: 'resource "aws_s3_bucket" "data" {', kind: 'removed' },
      { text: '  bucket = "old-name"', kind: 'removed' },
      { text: '}', kind: 'removed' },
      { text: 'resource "aws_s3_bucket" "data" {', kind: 'added' },
      { text: '  bucket = "new-name"', kind: 'added' },
      { text: '}', kind: 'added' },
    ],
  },
];

// --- tests ---

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hunkParser.extractChanges', () => {
  describe('new resource (GitHub shape — all lines added)', () => {
    it('returns one ResourceChange', () => {
      const result = extractChanges(newIAMPolicy);
      expect(result).toHaveLength(1);
    });

    it('sets correct id, type, name, filePath', () => {
      const [r] = extractChanges(newIAMPolicy);
      expect(r.id).toBe('aws_iam_policy.admin');
      expect(r.type).toBe('aws_iam_policy');
      expect(r.name).toBe('admin');
      expect(r.filePath).toBe('modules/iam/main.tf');
    });

    it('sets action = create', () => {
      const [r] = extractChanges(newIAMPolicy);
      expect(r.action).toBe('create');
    });

    it('extracts attribute changes from added lines', () => {
      const [r] = extractChanges(newIAMPolicy);
      const actionsAttr = r.changes.find((c) => c.attribute === 'actions');
      expect(actionsAttr?.newValue).toBe('["*"]');
      expect(actionsAttr?.oldValue).toBeUndefined();
    });
  });

  describe('deleted resource', () => {
    it('sets action = delete', () => {
      const [r] = extractChanges(deletedBucket);
      expect(r.action).toBe('delete');
    });

    it('marks riskProfile.isDestructive = true', () => {
      const [r] = extractChanges(deletedBucket);
      expect(r.riskProfile.isDestructive).toBe(true);
    });

    it('extracts oldValue for removed attributes', () => {
      const [r] = extractChanges(deletedBucket);
      const bucketAttr = r.changes.find((c) => c.attribute === 'bucket');
      expect(bucketAttr?.oldValue).toBe('"my-old-bucket"');
      expect(bucketAttr?.newValue).toBeUndefined();
    });
  });

  describe('updated resource with context header (GitHub shape)', () => {
    it('sets action = update', () => {
      const [r] = extractChanges(updatedSGIngress);
      expect(r.action).toBe('update');
    });

    it('extracts ingress block attribute with dot-notation prefix', () => {
      const [r] = extractChanges(updatedSGIngress);
      // Parser emits one AttributeChange per diff direction for the same attribute
      const added = r.changes.find((c) => c.attribute === 'ingress.cidr_blocks' && c.newValue);
      const removed = r.changes.find((c) => c.attribute === 'ingress.cidr_blocks' && c.oldValue);
      expect(added?.newValue).toBe('["0.0.0.0/0"]');
      expect(removed?.oldValue).toBe('["10.0.0.0/8"]');
    });
  });

  describe('GitLab shape (new resource)', () => {
    it('returns one ResourceChange with correct id', () => {
      const [r] = extractChanges(gitlabShape);
      expect(r.id).toBe('aws_instance.web');
      expect(r.action).toBe('create');
    });
  });

  describe('multiple resources in same file', () => {
    it('returns one ResourceChange per resource block', () => {
      const result = extractChanges(multiResource);
      expect(result).toHaveLength(2);
    });

    it('assigns correct ids to each resource', () => {
      const result = extractChanges(multiResource);
      const ids = result.map((r) => r.id);
      expect(ids).toContain('aws_s3_bucket.data');
      expect(ids).toContain('aws_iam_role.api');
    });
  });

  describe('replaced resource (removed + added same id)', () => {
    it('sets action = replace on the removed slice', () => {
      const result = extractChanges(replacedResource);
      const removed = result.find((r) => r.changes.some((c) => c.oldValue === '"old-name"'));
      expect(removed?.action).toBe('replace');
    });
  });

  describe('no resource headers visible', () => {
    it('returns a synthetic change with type = unknown when there are diff lines', () => {
      const [r] = extractChanges(noHeaderWithChanges);
      expect(r.type).toBe('unknown');
      expect(r.action).toBe('unknown');
    });
  });

  describe('empty file record', () => {
    it('returns [] when there are no lines', () => {
      expect(extractChanges(emptyFile)).toEqual([]);
    });
  });

  describe('empty input', () => {
    it('returns [] for empty records array', () => {
      expect(extractChanges([])).toEqual([]);
    });
  });
});

describe('hunkParser.parseDiff', () => {
  it('processes at least one file per idle callback when timeRemaining is 0', async () => {
    function makeInner(text: string, kind: 'added' | 'removed' | 'context') {
      return {
        textContent: text,
        closest: (selector: string) => {
          if (selector === '.blob-code-addition') return kind === 'added' ? {} : null;
          if (selector === '.blob-code-deletion') return kind === 'removed' ? {} : null;
          return null;
        },
      };
    }

    function makeRow(text: string, kind: 'added' | 'removed' | 'context') {
      const inner = makeInner(text, kind);
      return {
        querySelector: (selector: string) => (selector === '.blob-code-inner' ? inner : null),
      };
    }

    function makeFile(filePath: string) {
      const rows = [
        makeRow('resource "aws_s3_bucket" "data" {', 'added'),
        makeRow('  bucket = "example"', 'added'),
        makeRow('}', 'added'),
      ];
      return {
        getAttribute: (name: string) => (name === 'data-path' ? filePath : null),
        querySelector: () => null,
        querySelectorAll: (selector: string) => (selector === 'tr' ? rows : []),
      };
    }

    vi.stubGlobal('location', {
      href: 'https://github.com/example/repo/pull/1/files',
    });
    vi.stubGlobal('document', {
      querySelectorAll: (selector: string) =>
        selector === '.file' ? [makeFile('one.tf'), makeFile('two.tf')] : [],
    });
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      callback({ timeRemaining: () => 0 } as IdleDeadline);
      return 1;
    });

    const result = await parseDiff();
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.filePath)).toEqual(['one.tf', 'two.tf']);
  });
});
