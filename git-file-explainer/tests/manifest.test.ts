import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('manifest', () => {
  const manifestPath = resolve(__dirname, '../public/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    version?: string;
    permissions?: string[];
    storage?: { managed_schema?: string };
    content_scripts?: Array<{ matches?: string[] }>;
  };

  it('loads the content script on GitHub and GitLab blob pages', () => {
    const matches = manifest.content_scripts?.[0]?.matches ?? [];
    expect(matches).toContain('https://github.com/*/blob/*');
    expect(matches).toContain('https://gitlab.com/*/-/blob/*');
  });

  it('version is 1.0.0', () => {
    expect(manifest.version).toBe('1.0.0');
  });

  it('does not request the broad "tabs" permission', () => {
    expect(manifest.permissions ?? []).not.toContain('tabs');
  });

  it('declares managed_schema for enterprise policy support', () => {
    expect(manifest.storage?.managed_schema).toBe('managed_schema.json');
  });
});
