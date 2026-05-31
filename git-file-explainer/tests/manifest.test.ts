import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('manifest', () => {
  it('loads the content script on GitHub and GitLab blob pages', () => {
    const manifestPath = resolve(__dirname, '../public/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      content_scripts?: Array<{ matches?: string[] }>;
    };

    const matches = manifest.content_scripts?.[0]?.matches ?? [];
    expect(matches).toContain('https://github.com/*/blob/*');
    expect(matches).toContain('https://gitlab.com/*/-/blob/*');
  });
});
