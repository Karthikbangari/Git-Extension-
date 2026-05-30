import type { FileContent } from './types';

export interface FileExtractor {
  extract(): FileContent | null;
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rb: 'ruby',
    java: 'java',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    tf: 'terraform',
    hcl: 'hcl',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'shell',
    md: 'markdown',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
  };
  return map[ext] ?? ext;
}

function extractCodeLines(): string[] {
  // Layer 1: classic GitHub blob table
  const layer1 = Array.from(document.querySelectorAll<HTMLElement>('td.blob-code-inner')).map(
    (el) => el.textContent ?? ''
  );
  if (layer1.length > 0) return layer1;

  // Layer 2: LC-prefixed line cells (older GitHub layout)
  const layer2 = Array.from(document.querySelectorAll<HTMLElement>('td[id^="LC"]')).map(
    (el) => el.textContent ?? ''
  );
  if (layer2.length > 0) return layer2;

  // Layer 3: React blob viewer container
  const container = document.querySelector('[data-testid="blob-code-content"]');
  if (container) {
    const text = container.textContent ?? '';
    if (text.trim()) return text.split('\n');
  }

  return [];
}

export class GitHubDomExtractor implements FileExtractor {
  extract(): FileContent | null {
    const pathEl = document.querySelector<HTMLElement>(
      '[data-testid="blob-path"], .final-path, .breadcrumb-item-selected'
    );
    const filePath =
      pathEl?.textContent?.trim() ??
      location.pathname.split('/blob/').pop()?.split('/').slice(1).join('/') ??
      '';
    if (!filePath) return null;

    const lines = extractCodeLines();
    if (lines.length === 0) return null;

    return {
      filePath,
      language: detectLanguage(filePath),
      lines,
    };
  }
}

export class GitLabDomExtractor implements FileExtractor {
  extract(): FileContent | null {
    // Phase 3 — GitLab DOM extraction
    const pathEl = document.querySelector<HTMLElement>('.file-title-name');
    const filePath = pathEl?.textContent?.trim() ?? '';
    if (!filePath) return null;

    const codeLines = Array.from(document.querySelectorAll<HTMLElement>('.blob-content .line')).map(
      (el) => el.textContent ?? ''
    );
    if (codeLines.length === 0) return null;

    return {
      filePath,
      language: detectLanguage(filePath),
      lines: codeLines,
    };
  }
}
