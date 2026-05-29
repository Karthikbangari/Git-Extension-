import { isGitHubPR } from './pageDetector';
import type { ResourceChange, AttributeChange, ActionType } from './types';

export type LineKind = 'added' | 'removed' | 'context';

export interface LineRecord {
  text: string;
  kind: LineKind;
}

export interface FileRecord {
  filePath: string;
  lines: LineRecord[];
}

// Matches: resource "type" "name" {
const RESOURCE_RE = /^\s*resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/;
// Matches: word { or word "label" { — excludes resource (two labels) and attr = {
const BLOCK_OPEN_RE = /^\s*(\w+)(?:\s+"[^"]+")?\s*\{/;
// Matches a line whose first non-whitespace char is }
const BLOCK_CLOSE_RE = /^\s*\}/;
// Matches: attr = value
const ATTR_RE = /^\s*([\w-]+)\s*=\s*(.*\S)/;

export function scrapeGitHub(): FileRecord[] {
  const allFiles = document.querySelectorAll<HTMLElement>('.file');
  if (allFiles.length === 0) return [];

  const tfContainers: Array<{ container: HTMLElement; filePath: string }> = [];
  for (const container of allFiles) {
    // data-path may be on the container, a nested element (older GitHub), or absent entirely
    // (current GitHub). Fall back to the link title and text in .file-header.
    const filePath =
      container.getAttribute('data-path') ??
      container.querySelector<HTMLElement>('[data-path]')?.getAttribute('data-path') ??
      container.querySelector<HTMLElement>('.file-header a[title]')?.getAttribute('title') ??
      container.querySelector<HTMLElement>('.file-header .Truncate-text')?.textContent?.trim() ??
      '';
    if (filePath.endsWith('.tf')) tfContainers.push({ container, filePath });
  }
  if (tfContainers.length === 0) return [];

  return tfContainers.flatMap(({ container, filePath }) => {
    if (!filePath) return [];

    const lines: LineRecord[] = [];
    for (const row of container.querySelectorAll<HTMLElement>('tr')) {
      const inner = row.querySelector<HTMLElement>('.blob-code-inner');
      if (!inner) continue;
      const text = inner.textContent ?? '';
      let kind: LineKind = 'context';
      if (inner.closest('.blob-code-addition')) kind = 'added';
      else if (inner.closest('.blob-code-deletion')) kind = 'removed';
      lines.push({ text, kind });
    }
    return [{ filePath, lines }];
  });
}

export function scrapeGitLab(): FileRecord[] {
  const containers = document.querySelectorAll<HTMLElement>('.diff-file');
  if (containers.length === 0) return [];

  return Array.from(containers).flatMap((container) => {
    const titleEl = container.querySelector<HTMLElement>('.file-title-name');
    const filePath = titleEl?.textContent?.trim() ?? '';
    if (!filePath.endsWith('.tf')) return [];

    const lines: LineRecord[] = [];
    for (const holder of container.querySelectorAll<HTMLElement>('.line_holder')) {
      const content = holder.querySelector<HTMLElement>('.line_content');
      if (!content) continue;
      const text = content.textContent ?? '';
      let kind: LineKind = 'context';
      if (holder.classList.contains('new')) kind = 'added';
      else if (holder.classList.contains('old')) kind = 'removed';
      lines.push({ text, kind });
    }
    return [{ filePath, lines }];
  });
}

function extractAttributes(lines: LineRecord[]): AttributeChange[] {
  const changes: AttributeChange[] = [];
  const blockStack: string[] = [];

  for (const { text, kind } of lines) {
    if (kind === 'context') {
      const open = BLOCK_OPEN_RE.exec(text);
      if (open && !RESOURCE_RE.test(text)) blockStack.push(open[1]);
      else if (BLOCK_CLOSE_RE.test(text) && blockStack.length > 0) blockStack.pop();
      continue;
    }

    const open = BLOCK_OPEN_RE.exec(text);
    if (open && !RESOURCE_RE.test(text)) {
      blockStack.push(open[1]);
      continue;
    }
    if (BLOCK_CLOSE_RE.test(text)) {
      if (blockStack.length > 0) blockStack.pop();
      continue;
    }

    const m = ATTR_RE.exec(text);
    if (!m) continue;

    const prefix = blockStack.length > 0 ? `${blockStack.join('.')}.` : '';
    changes.push({
      attribute: `${prefix}${m[1]}`,
      newValue: kind === 'added' ? m[2].trim() : undefined,
      oldValue: kind === 'removed' ? m[2].trim() : undefined,
      isSensitive: false,
    });
  }

  return changes;
}

function parseFileRecord(record: FileRecord): ResourceChange[] {
  const { filePath, lines } = record;

  interface Slice {
    type: string;
    name: string;
    headerKind: LineKind;
    start: number;
    end: number;
  }

  const slices: Slice[] = [];
  let depth = 0;
  let current: Omit<Slice, 'end'> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const { text, kind } = lines[i];

    if (current === null) {
      const m = RESOURCE_RE.exec(text);
      if (m) {
        current = { type: m[1], name: m[2], headerKind: kind, start: i };
        depth = 1;
      }
    } else {
      if (BLOCK_OPEN_RE.test(text) && !RESOURCE_RE.test(text)) depth++;
      if (BLOCK_CLOSE_RE.test(text)) {
        depth--;
        if (depth === 0) {
          slices.push({ ...current, end: i });
          current = null;
        }
      }
    }
  }

  if (slices.length === 0) {
    const hasChanges = lines.some((l) => l.kind !== 'context');
    if (!hasChanges) return [];
    return [
      {
        id: filePath,
        type: 'unknown',
        name: filePath,
        action: 'unknown',
        filePath,
        changes: [],
        riskProfile: { level: 'low', reasons: [], isDestructive: false },
      },
    ];
  }

  return slices.map((slice) => {
    const sliceLines = lines.slice(slice.start, slice.end + 1);
    const removedLines = sliceLines.filter((l) => l.kind === 'removed');

    let action: ActionType = 'update';
    if (slice.headerKind === 'added' && removedLines.length === 0) {
      action = 'create';
    } else if (slice.headerKind === 'removed') {
      const hasMatchingAdd = slices.some(
        (s) =>
          s !== slice && s.type === slice.type && s.name === slice.name && s.headerKind === 'added'
      );
      action = hasMatchingAdd ? 'replace' : 'delete';
    }

    return {
      id: `${slice.type}.${slice.name}`,
      type: slice.type,
      name: slice.name,
      action,
      filePath,
      changes: extractAttributes(sliceLines),
      riskProfile: {
        level: 'low',
        reasons: [],
        isDestructive: action === 'delete',
      },
      domReference: { dataFilePath: filePath },
    };
  });
}

export function extractChanges(records: FileRecord[]): ResourceChange[] {
  const results: ResourceChange[] = [];
  for (const record of records) {
    results.push(...parseFileRecord(record));
  }
  return results;
}

export async function parseDiff(): Promise<ResourceChange[]> {
  try {
    const records = isGitHubPR() ? scrapeGitHub() : scrapeGitLab();
    if (records.length === 0) return [];

    return new Promise((resolve) => {
      const results: ResourceChange[] = [];
      let idx = 0;

      const step: IdleRequestCallback = (deadline) => {
        while (idx < records.length && deadline.timeRemaining() > 0) {
          results.push(...parseFileRecord(records[idx++]));
        }
        if (idx < records.length) requestIdleCallback(step);
        else resolve(results);
      };

      requestIdleCallback(step);
    });
  } catch {
    return [];
  }
}
