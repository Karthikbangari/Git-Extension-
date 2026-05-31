import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectLanguage,
  estimateTokens,
  GitHubDomExtractor,
  GitLabDomExtractor,
} from '../src/content/fileExtractor';

describe('detectLanguage', () => {
  it('maps ts to TypeScript', () => {
    expect(detectLanguage('src/index.ts')).toBe('TypeScript');
  });

  it('maps py to Python', () => {
    expect(detectLanguage('app.py')).toBe('Python');
  });

  it('maps tf to Terraform', () => {
    expect(detectLanguage('main.tf')).toBe('Terraform');
  });

  it('maps yml to YAML', () => {
    expect(detectLanguage('config.yml')).toBe('YAML');
  });

  it('returns the uppercased extension for unrecognised types', () => {
    expect(detectLanguage('schema.xyz')).toBe('XYZ');
  });

  it('returns Makefile for a file named Makefile', () => {
    expect(detectLanguage('Makefile')).toBe('Makefile');
  });
});

describe('estimateTokens', () => {
  it('returns 0 for 0 chars', () => {
    expect(estimateTokens(0)).toBe(0);
  });

  it('rounds up to nearest token', () => {
    expect(estimateTokens(1)).toBe(1);
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(5)).toBe(2);
  });

  it('estimates 400 chars as 100 tokens', () => {
    expect(estimateTokens(400)).toBe(100);
  });

  it('estimates 12000 chars as 3000 tokens', () => {
    expect(estimateTokens(12_000)).toBe(3_000);
  });
});

describe('GitHubDomExtractor.extract', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no code lines are found via any selector', () => {
    const pathEl = document.createElement('span');
    pathEl.setAttribute('data-testid', 'blob-path');
    pathEl.textContent = 'README.md';
    document.body.appendChild(pathEl);

    const extractor = new GitHubDomExtractor();
    expect(extractor.extract()).toBeNull();
  });

  it('extracts content via layer 1 (td.blob-code-inner)', () => {
    const pathEl = document.createElement('span');
    pathEl.setAttribute('data-testid', 'blob-path');
    pathEl.textContent = 'src/index.ts';
    document.body.appendChild(pathEl);

    const table = document.createElement('table');
    for (const text of ['const x = 1;', 'export default x;']) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'blob-code-inner';
      td.textContent = text;
      tr.appendChild(td);
      table.appendChild(tr);
    }
    document.body.appendChild(table);

    const result = new GitHubDomExtractor().extract();
    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('src/index.ts');
    expect(result?.language).toBe('TypeScript');
    expect(result?.lines).toEqual(['const x = 1;', 'export default x;']);
  });

  it('falls back to td[id^="LC"] when layer 1 yields nothing', () => {
    const pathEl = document.createElement('span');
    pathEl.setAttribute('data-testid', 'blob-path');
    pathEl.textContent = 'app.py';
    document.body.appendChild(pathEl);

    for (const [id, text] of [
      ['LC1', 'def hello():'],
      ['LC2', '    print("hi")'],
    ] as [string, string][]) {
      const td = document.createElement('td');
      td.id = id;
      td.textContent = text;
      document.body.appendChild(td);
    }

    const result = new GitHubDomExtractor().extract();
    expect(result?.lines).toEqual(['def hello():', '    print("hi")']);
    expect(result?.language).toBe('Python');
  });

  it('falls back to [data-testid="blob-code-content"] when layers 1 and 2 yield nothing', () => {
    const pathEl = document.createElement('span');
    pathEl.setAttribute('data-testid', 'blob-path');
    pathEl.textContent = 'main.go';
    document.body.appendChild(pathEl);

    const container = document.createElement('div');
    container.setAttribute('data-testid', 'blob-code-content');
    container.textContent = 'package main\n\nfunc main() {}';
    document.body.appendChild(container);

    const result = new GitHubDomExtractor().extract();
    expect(result?.lines).toContain('package main');
    expect(result?.language).toBe('Go');
  });

  it('falls back to current GitHub React code cells', () => {
    const pathEl = document.createElement('span');
    pathEl.setAttribute('data-testid', 'breadcrumbs-filename');
    pathEl.textContent = '/package.json';
    document.body.appendChild(pathEl);

    for (const text of ['{', '  "name": "terraf"', '}']) {
      const line = document.createElement('div');
      line.setAttribute('data-testid', 'code-cell');
      line.textContent = text;
      document.body.appendChild(line);
    }

    const result = new GitHubDomExtractor().extract();
    expect(result?.filePath).toBe('package.json');
    expect(result?.lines).toEqual(['{', '  "name": "terraf"', '}']);
    expect(result?.language).toBe('JSON');
  });

  it('falls back to the current GitHub file-content textarea', () => {
    const pathEl = document.createElement('span');
    pathEl.setAttribute('data-testid', 'blob-path');
    pathEl.textContent = 'README.md';
    document.body.appendChild(pathEl);

    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-testid', 'read-only-cursor-text-area');
    textarea.setAttribute('aria-label', 'file content');
    textarea.value = '# Project\n\nHello';
    document.body.appendChild(textarea);

    const result = new GitHubDomExtractor().extract();
    expect(result?.lines).toEqual(['# Project', '', 'Hello']);
    expect(result?.language).toBe('Markdown');
  });

  it('returns the correct language inferred from the file path', () => {
    const pathEl = document.createElement('span');
    pathEl.setAttribute('data-testid', 'blob-path');
    pathEl.textContent = 'infra/main.tf';
    document.body.appendChild(pathEl);

    const td = document.createElement('td');
    td.className = 'blob-code-inner';
    td.textContent = 'resource "aws_s3_bucket" "b" {}';
    document.body.appendChild(td);

    const result = new GitHubDomExtractor().extract();
    expect(result?.language).toBe('Terraform');
  });
});

describe('GitLabDomExtractor.extract', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts file path and code from GitLab blob content', () => {
    const pathEl = document.createElement('span');
    pathEl.className = 'file-title-name';
    pathEl.textContent = 'src/main.go';
    document.body.appendChild(pathEl);

    const content = document.createElement('div');
    content.className = 'blob-content';
    for (const text of ['package main', 'func main() {}']) {
      const line = document.createElement('span');
      line.className = 'line';
      line.textContent = text;
      content.appendChild(line);
    }
    document.body.appendChild(content);

    const result = new GitLabDomExtractor().extract();
    expect(result?.filePath).toBe('src/main.go');
    expect(result?.language).toBe('Go');
    expect(result?.lines).toEqual(['package main', 'func main() {}']);
  });

  it('returns null when GitLab file content has no line nodes', () => {
    const pathEl = document.createElement('span');
    pathEl.className = 'file-title-name';
    pathEl.textContent = 'README.md';
    document.body.appendChild(pathEl);

    expect(new GitLabDomExtractor().extract()).toBeNull();
  });

  it('extracts content via layer 1 (td.line_content) before .line', () => {
    const pathEl = document.createElement('span');
    pathEl.className = 'file-title-name';
    pathEl.textContent = 'app.rb';
    document.body.appendChild(pathEl);

    const blob = document.createElement('div');
    blob.className = 'blob-content';
    const table = document.createElement('table');
    for (const text of ['def greet', '  puts "hi"', 'end']) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'line_content';
      td.textContent = text;
      tr.appendChild(td);
      table.appendChild(tr);
    }
    blob.appendChild(table);
    document.body.appendChild(blob);

    const result = new GitLabDomExtractor().extract();
    expect(result?.lines).toEqual(['def greet', '  puts "hi"', 'end']);
    expect(result?.language).toBe('Ruby');
  });

  it('returns null when no file path element is found', () => {
    const blob = document.createElement('div');
    blob.className = 'blob-content';
    const line = document.createElement('span');
    line.className = 'line';
    line.textContent = 'some code';
    blob.appendChild(line);
    document.body.appendChild(blob);

    expect(new GitLabDomExtractor().extract()).toBeNull();
  });
});
