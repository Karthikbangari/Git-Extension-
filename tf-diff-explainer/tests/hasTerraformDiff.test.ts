// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { hasTerraformDiff } from '../src/content/pageDetector';

function setBody(html: string) {
  document.body.innerHTML = html;
}

describe('hasTerraformDiff', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('fallback 1 — data-path on container', () => {
    it('returns true when a .file element carries data-path ending in .tf', () => {
      setBody('<div class="file" data-path="modules/main.tf"></div>');
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns true when data-path ends in .ts', () => {
      setBody('<div class="file" data-path="modules/main.ts"></div>');
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns true when data-path ends in .py', () => {
      setBody('<div class="file" data-path="scripts/deploy.py"></div>');
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns false when data-path ends in unsupported extension .sh', () => {
      setBody('<div class="file" data-path="scripts/run.sh"></div>');
      expect(hasTerraformDiff()).toBe(false);
    });
  });

  describe('fallback 2 — data-path on .file-header child', () => {
    it('returns true when .file-header itself carries data-path ending in .tf', () => {
      setBody(
        '<div class="file"><div class="file-header" data-path="infra/network.tf"></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns true when .file-header data-path ends in .json', () => {
      setBody(
        '<div class="file"><div class="file-header" data-path="infra/vars.json"></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns false when .file-header data-path ends in unsupported extension .sh', () => {
      setBody('<div class="file"><div class="file-header" data-path="scripts/run.sh"></div></div>');
      expect(hasTerraformDiff()).toBe(false);
    });
  });

  describe('fallback 3 — a[title] inside .file-header', () => {
    it('returns true when an anchor title ends in .tf', () => {
      setBody(
        '<div class="file"><div class="file-header"><a title="infra/main.tf">infra/main.tf</a></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns true when anchor title ends in .go', () => {
      setBody(
        '<div class="file"><div class="file-header"><a title="cmd/main.go">cmd/main.go</a></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns true when anchor title ends in .tsx', () => {
      setBody(
        '<div class="file"><div class="file-header"><a title="src/App.tsx">src/App.tsx</a></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns false when anchor title ends in unsupported extension .sh', () => {
      setBody(
        '<div class="file"><div class="file-header"><a title="scripts/run.sh">scripts/run.sh</a></div></div>'
      );
      expect(hasTerraformDiff()).toBe(false);
    });
  });

  describe('fallback 4 — .Truncate-text inside .file-header', () => {
    it('returns true when .Truncate-text text content ends in .tf', () => {
      setBody(
        '<div class="file"><div class="file-header"><span class="Truncate-text">modules/vpc.tf</span></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns true when .Truncate-text text content ends in .py', () => {
      setBody(
        '<div class="file"><div class="file-header"><span class="Truncate-text">scripts/deploy.py</span></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns true when .Truncate-text text content ends in .yaml', () => {
      setBody(
        '<div class="file"><div class="file-header"><span class="Truncate-text">config/app.yaml</span></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns false when .Truncate-text ends in unsupported extension .sh', () => {
      setBody(
        '<div class="file"><div class="file-header"><span class="Truncate-text">scripts/run.sh</span></div></div>'
      );
      expect(hasTerraformDiff()).toBe(false);
    });

    it('trims whitespace before checking extension', () => {
      setBody(
        '<div class="file"><div class="file-header"><span class="Truncate-text">  modules/vpc.tf  </span></div></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });
  });

  describe('GitLab .file-title-name', () => {
    it('returns true when a GitLab file title ends in .tf', () => {
      setBody(
        '<div class="diff-file-changes"><span class="file-title-name">infra/main.tf</span></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns true when a GitLab file title ends in .sql', () => {
      setBody(
        '<div class="diff-file-changes"><span class="file-title-name">db/migration.sql</span></div>'
      );
      expect(hasTerraformDiff()).toBe(true);
    });

    it('returns false when no file matches a supported extension', () => {
      setBody(
        '<div class="diff-file-changes"><span class="file-title-name">Dockerfile</span></div>'
      );
      expect(hasTerraformDiff()).toBe(false);
    });
  });

  it('returns false on empty body', () => {
    expect(hasTerraformDiff()).toBe(false);
  });

  it('returns false when a supported extension appears mid-path but not at end', () => {
    setBody(
      '<div class="file"><div class="file-header"><a title="infra/.tf.bak">infra/.tf.bak</a></div></div>'
    );
    expect(hasTerraformDiff()).toBe(false);
  });
});
