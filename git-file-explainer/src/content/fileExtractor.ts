import type { FileContent } from './types';

export interface FileExtractor {
  extract(): FileContent | null;
}

const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'ico',
  'webp',
  'svg',
  'mp4',
  'mp3',
  'wav',
  'ogg',
  'webm',
  'pdf',
  'zip',
  'tar',
  'gz',
  'bz2',
  'xz',
  '7z',
  'rar',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'otf',
  'psd',
  'ai',
  'sketch',
  'fig',
  'db',
  'sqlite',
  'parquet',
]);

export function isBinaryExtension(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return BINARY_EXTENSIONS.has(ext);
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    mjs: 'JavaScript',
    cjs: 'JavaScript',
    py: 'Python',
    go: 'Go',
    rb: 'Ruby',
    rake: 'Ruby',
    java: 'Java',
    kt: 'Kotlin',
    kts: 'Kotlin',
    cs: 'C#',
    cpp: 'C++',
    cc: 'C++',
    cxx: 'C++',
    hpp: 'C++',
    c: 'C',
    h: 'C',
    rs: 'Rust',
    swift: 'Swift',
    php: 'PHP',
    scala: 'Scala',
    tf: 'Terraform',
    tfvars: 'Terraform',
    hcl: 'HCL',
    json: 'JSON',
    jsonc: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    xml: 'XML',
    sh: 'Shell',
    bash: 'Shell',
    zsh: 'Shell',
    fish: 'Shell',
    ps1: 'PowerShell',
    md: 'Markdown',
    mdx: 'Markdown',
    sql: 'SQL',
    html: 'HTML',
    htm: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'SASS',
    less: 'Less',
    vue: 'Vue',
    svelte: 'Svelte',
    r: 'R',
    lua: 'Lua',
    dart: 'Dart',
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
    gradle: 'Gradle',
    proto: 'Protobuf',
    graphql: 'GraphQL',
    gql: 'GraphQL',
  };
  return map[ext] ?? detectLanguageFromDOM() ?? ext.toUpperCase() ?? 'Unknown';
}

export function detectLanguageFromDOM(): string | null {
  // GitHub blob page language indicator
  const candidates = [
    document.querySelector<HTMLElement>('[data-language]')?.dataset.language,
    document
      .querySelector<HTMLElement>('.repository-lang-stats-graph [aria-label]')
      ?.getAttribute('aria-label'),
    document.querySelector<HTMLElement>('.blob-code-lang')?.textContent?.trim(),
  ];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim();
  }
  return null;
}

export interface TruncateResult {
  lines: string[];
  truncated: boolean;
  originalLineCount: number;
}

export function smartTruncate(lines: string[], headLines = 300, tailLines = 50): TruncateResult {
  const original = lines.length;
  const max = headLines + tailLines;
  if (original <= max) {
    return { lines, truncated: false, originalLineCount: original };
  }
  const head = lines.slice(0, headLines);
  const tail = lines.slice(-tailLines);
  return {
    lines: [...head, `// ... ${original - max} lines omitted ...`, ...tail],
    truncated: true,
    originalLineCount: original,
  };
}

export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

const MAX_CONTENT_CHARS = 12_000;

function capContent(lines: string[]): string {
  const raw = lines.join('\n');
  if (raw.length <= MAX_CONTENT_CHARS) return raw;
  return raw.slice(0, MAX_CONTENT_CHARS) + '\n... (character limit reached)';
}

function normalizeFilePath(filePath: string): string {
  return filePath.trim().replace(/^\/+/, '');
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

  // Layer 4: current GitHub React code view
  const layer4 = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="code-cell"]'))
    .map((el) => el.textContent ?? '')
    .filter((line) => line.trim().length > 0);
  if (layer4.length > 0) return layer4;

  // Layer 5: accessibility textarea
  const textarea = document.querySelector<HTMLTextAreaElement>(
    '[data-testid="read-only-cursor-text-area"][aria-label="file content"]'
  );
  if (textarea?.value.trim()) return textarea.value.split('\n');

  return [];
}

export class GitHubDomExtractor implements FileExtractor {
  extract(): FileContent | null {
    const pathEl = document.querySelector<HTMLElement>(
      '[data-testid="blob-path"], [data-testid="breadcrumbs-filename"], .final-path, .breadcrumb-item-selected'
    );
    const filePath =
      normalizeFilePath(pathEl?.textContent ?? '') ||
      (location.pathname.split('/blob/').pop()?.split('/').slice(1).join('/') ?? '');
    if (!filePath) return null;

    if (isBinaryExtension(filePath)) {
      return { filePath, language: detectLanguage(filePath), lines: [], isBinary: true };
    }

    const rawLines = extractCodeLines();
    if (rawLines.length === 0) return null;

    const { lines, truncated, originalLineCount } = smartTruncate(rawLines);
    void capContent; // referenced below via content builder in index.ts

    return {
      filePath,
      language: detectLanguage(filePath),
      lines,
      truncated,
      originalLineCount,
    };
  }

  buildContent(fileContent: FileContent): string {
    return capContent(fileContent.lines);
  }

  async extractWithFallback(): Promise<FileContent | null> {
    const dom = this.extract();
    if (dom && dom.lines.length > 0) return dom;
    return fetchRawGitHubContent(location.href, location.pathname);
  }
}

export async function fetchRawGitHubContent(
  _pageUrl: string,
  pathname: string
): Promise<FileContent | null> {
  // Convert blob URL to raw URL: /owner/repo/blob/branch/path → raw.githubusercontent.com/owner/repo/branch/path
  const match = pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, owner, repo, branch, path] = match;
  if (isBinaryExtension(path)) {
    return { filePath: path, language: detectLanguage(path), lines: [], isBinary: true };
  }
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GFE_FETCH_RAW_CONTENT', payload: { url: rawUrl } },
      (response: unknown) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const r = response as { text?: string; error?: string } | null;
        if (!r || r.error || !r.text) {
          resolve(null);
          return;
        }
        const lines = r.text.split('\n');
        const filePath = path;
        const { lines: truncLines, truncated, originalLineCount } = smartTruncate(lines);
        resolve({
          filePath,
          language: detectLanguage(filePath),
          lines: truncLines,
          truncated,
          originalLineCount,
        });
      }
    );
  });
}

export class GitLabDomExtractor implements FileExtractor {
  extract(): FileContent | null {
    const pathEl = document.querySelector<HTMLElement>(
      '.file-title-name, .js-blob-filename, .breadcrumb-item-selected'
    );
    const filePath =
      pathEl?.textContent?.trim() ??
      location.pathname.split('/-/blob/').pop()?.split('/').slice(1).join('/') ??
      '';
    if (!filePath) return null;

    if (isBinaryExtension(filePath)) {
      return { filePath, language: detectLanguage(filePath), lines: [], isBinary: true };
    }

    let rawLines: string[] = [];

    // Layer 1: classic line_content table cells
    const layer1 = Array.from(
      document.querySelectorAll<HTMLElement>('.blob-content td.line_content')
    ).map((el) => el.textContent ?? '');
    if (layer1.length > 0) rawLines = layer1;

    // Layer 2: .line class inside blob/file content
    if (rawLines.length === 0) {
      const layer2 = Array.from(
        document.querySelectorAll<HTMLElement>('.blob-content .line, .file-content .line')
      ).map((el) => el.textContent ?? '');
      if (layer2.length > 0) rawLines = layer2;
    }

    // Layer 3: full blob-content-holder
    if (rawLines.length === 0) {
      const container = document.querySelector<HTMLElement>('#blob-content-holder, .file-content');
      if (container) {
        const text = container.textContent ?? '';
        if (text.trim()) rawLines = text.split('\n');
      }
    }

    if (rawLines.length === 0) return null;

    const { lines, truncated, originalLineCount } = smartTruncate(rawLines);
    return { filePath, language: detectLanguage(filePath), lines, truncated, originalLineCount };
  }

  buildContent(fileContent: FileContent): string {
    return capContent(fileContent.lines);
  }
}
