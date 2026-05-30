import type { FileContent } from './types';

export interface FileExtractor {
  extract(): FileContent | null;
}

function detectLanguage(filePath: string): string {
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

export class GitHubDomExtractor implements FileExtractor {
  extract(): FileContent | null {
    // Phase 1 stub — DOM extraction wired in Phase 2
    const pathEl = document.querySelector<HTMLElement>(
      '[data-testid="blob-path"], .final-path, .breadcrumb-item-selected'
    );
    const filePath = pathEl?.textContent?.trim() ?? location.pathname.split('/blob/').pop() ?? '';
    if (!filePath) return null;

    const codeLines = Array.from(
      document.querySelectorAll<HTMLElement>('.blob-code-inner, .blob-code .blob-code-inner')
    ).map((el) => el.textContent ?? '');

    return {
      filePath,
      language: detectLanguage(filePath),
      lines: codeLines,
    };
  }
}

export class GitLabDomExtractor implements FileExtractor {
  extract(): FileContent | null {
    // Phase 1 stub — DOM extraction wired in Phase 2
    const pathEl = document.querySelector<HTMLElement>('.file-title-name');
    const filePath = pathEl?.textContent?.trim() ?? '';
    if (!filePath) return null;

    const codeLines = Array.from(document.querySelectorAll<HTMLElement>('.blob-content .line')).map(
      (el) => el.textContent ?? ''
    );

    return {
      filePath,
      language: detectLanguage(filePath),
      lines: codeLines,
    };
  }
}
