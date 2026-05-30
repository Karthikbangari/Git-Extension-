/**
 * TF Diff Explainer — Master source file (read-only reference)
 *
 * All modules in one place for reading and review.
 * The actual build uses three separate entry points:
 *   content script  → src/content/index.ts
 *   service worker  → src/background/index.ts
 *   popup           → src/popup/popup.ts
 */

// =============================================================================
// SECTION 1: TYPES  (src/content/types.ts)
// =============================================================================

/** resource id → set of resource ids that resource references (its dependencies) */
type DependencyGraph = Map<string, Set<string>>;

type ActionType = 'create' | 'update' | 'delete' | 'replace' | 'unknown';

type RiskLevel = 'low' | 'medium' | 'high';

interface AttributeChange {
  attribute: string;
  oldValue?: string;
  newValue?: string;
  isSensitive: boolean;
}

interface ResourceChange {
  id: string;
  type: string;
  name: string;
  action: ActionType;
  filePath: string;
  changes: AttributeChange[];
  riskProfile: {
    level: RiskLevel;
    reasons: string[];
    isDestructive: boolean;
  };
  domReference?: {
    dataFilePath: string;
    anchorId?: string;
  };
}

interface AISummaryResult {
  summary: string;
  risks: string[];
  rollback: string[];
  prDescription: string;
}

// =============================================================================
// SECTION 2: PAGE DETECTOR  (src/content/pageDetector.ts)
// =============================================================================

const GITHUB_PR_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/;
const GITLAB_MR_RE = /^https:\/\/gitlab\.com\/[^/]+\/[^/]+\/-\/merge_requests\/\d+/;

function isGitHubPR(url = location.href): boolean {
  return GITHUB_PR_RE.test(url);
}

function isGitLabMR(url = location.href): boolean {
  return GITLAB_MR_RE.test(url);
}

function isSupportedPage(url = location.href): boolean {
  return isGitHubPR(url) || isGitLabMR(url);
}

function hasTerraformDiff(): boolean {
  // Fast path: data-path attribute present (older GitHub, some GitLab)
  if (document.querySelector('[data-path$=".tf"], .file-header[data-path$=".tf"]')) return true;

  // Current GitHub: filename lives in a[title] or .Truncate-text inside .file-header
  for (const header of document.querySelectorAll('.file-header')) {
    if (header.querySelector('a[title$=".tf"]')) return true;
    const text = header.querySelector('.Truncate-text')?.textContent?.trim() ?? '';
    if (text.endsWith('.tf')) return true;
  }

  // GitLab
  for (const el of document.querySelectorAll('.diff-file-changes .file-title-name')) {
    if (el.textContent?.trim().endsWith('.tf')) return true;
  }
  return false;
}

function watchForNavigation(callback: (url: string) => void): MutationObserver {
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback(location.href);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

// =============================================================================
// SECTION 3: STORAGE  (src/utils/storage.ts)
// =============================================================================

type SerializedGraph = Record<string, string[]>;

function cacheKey(url: string): string {
  return `tfe_cache_${url}`;
}

function serializeGraph(graph: DependencyGraph): SerializedGraph {
  const obj: SerializedGraph = {};
  for (const [k, v] of graph) obj[k] = [...v];
  return obj;
}

function deserializeGraph(obj: SerializedGraph): DependencyGraph {
  const map: DependencyGraph = new Map();
  for (const [k, v] of Object.entries(obj)) map.set(k, new Set(v));
  return map;
}

async function getCachedAnalysis(
  url: string
): Promise<{ changes: ResourceChange[]; graph: DependencyGraph } | null> {
  const key = cacheKey(url);
  try {
    const result = await chrome.storage.session.get(key);
    const entry = result[key] as { changes: ResourceChange[]; graph: SerializedGraph } | undefined;
    if (!entry) return null;
    return { changes: entry.changes, graph: deserializeGraph(entry.graph) };
  } catch {
    return null;
  }
}

async function setCachedAnalysis(
  url: string,
  changes: ResourceChange[],
  graph: DependencyGraph
): Promise<void> {
  try {
    await chrome.storage.session.set({
      [cacheKey(url)]: { changes, graph: serializeGraph(graph) },
    });
  } catch {
    // Analysis can still render when the ephemeral cache is unavailable.
  }
}

async function clearCachedAnalysis(url: string): Promise<void> {
  try {
    await chrome.storage.session.remove(cacheKey(url));
  } catch {}
}

async function getApiKey(): Promise<string | null> {
  try {
    const { apiKey: managedKey } = await chrome.storage.managed.get('apiKey');
    if (managedKey) return managedKey as string;
  } catch {
    // managed storage unavailable
  }
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return (apiKey as string) || null;
}

async function isManagedApiKey(): Promise<boolean> {
  try {
    const { apiKey } = await chrome.storage.managed.get('apiKey');
    return !!apiKey;
  } catch {
    return false;
  }
}

async function isManagedDisabledHosts(): Promise<boolean> {
  try {
    const { disabledHosts } = await chrome.storage.managed.get('disabledHosts');
    return Array.isArray(disabledHosts);
  } catch {
    return false;
  }
}

async function isEnabledForHost(host: string): Promise<boolean> {
  try {
    const { disabledHosts: managedDisabled } = await chrome.storage.managed.get('disabledHosts');
    if (Array.isArray(managedDisabled)) {
      return !(managedDisabled as string[]).includes(host);
    }
  } catch {}
  const { disabledHosts = [] } = await chrome.storage.local.get('disabledHosts');
  return !(disabledHosts as string[]).includes(host);
}

async function toggleHost(host: string, enabled: boolean): Promise<void> {
  const { disabledHosts = [] } = await chrome.storage.local.get('disabledHosts');
  const current = disabledHosts as string[];
  const updated = enabled ? current.filter((h) => h !== host) : [...new Set([...current, host])];
  await chrome.storage.local.set({ disabledHosts: updated });
}

function aiCacheKey(hash: string): string {
  return `tfe_ai_${hash}`;
}

async function getCachedAISummary(hash: string): Promise<AISummaryResult | null> {
  const key = aiCacheKey(hash);
  const result = await chrome.storage.local.get(key);
  return (result[key] as AISummaryResult) ?? null;
}

async function setCachedAISummary(hash: string, result: AISummaryResult): Promise<void> {
  await chrome.storage.local.set({ [aiCacheKey(hash)]: result });
}

// =============================================================================
// SECTION 4: HUNK PARSER  (src/content/hunkParser.ts)
// =============================================================================

type LineKind = 'added' | 'removed' | 'context';

interface LineRecord {
  text: string;
  kind: LineKind;
}

interface FileRecord {
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

function scrapeGitHub(): FileRecord[] {
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

function scrapeGitLab(): FileRecord[] {
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
      riskProfile: { level: 'low', reasons: [], isDestructive: action === 'delete' },
      domReference: { dataFilePath: filePath },
    };
  });
}

function extractChanges(records: FileRecord[]): ResourceChange[] {
  const results: ResourceChange[] = [];
  for (const record of records) results.push(...parseFileRecord(record));
  return results;
}

async function parseDiff(): Promise<ResourceChange[]> {
  try {
    const records = isGitHubPR() ? scrapeGitHub() : scrapeGitLab();
    if (records.length === 0) return [];
    return new Promise((resolve) => {
      const results: ResourceChange[] = [];
      let idx = 0;
      const step: IdleRequestCallback = (deadline) => {
        let processed = 0;
        while (idx < records.length && (processed === 0 || deadline.timeRemaining() > 0)) {
          results.push(...parseFileRecord(records[idx++]));
          processed++;
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

// =============================================================================
// SECTION 5: RISK CLASSIFIER  (src/content/riskClassifier.ts)
// =============================================================================

interface Rule {
  test: (change: ResourceChange) => string | null;
  level: RiskLevel;
  isDestructive: boolean;
}

function lastPart(attr: string): string {
  return attr.split('.').pop() ?? attr;
}

const RULES: Rule[] = [
  {
    test: (change) =>
      change.changes.some((c) => {
        if (!c.newValue) return false;
        const last = lastPart(c.attribute).toLowerCase();
        return (last === 'actions' || last === 'action') && /"\*"/.test(c.newValue);
      })
        ? 'IAM wildcard action'
        : null,
    level: 'high',
    isDestructive: false,
  },
  {
    test: (change) =>
      change.changes.some((c) => {
        if (!c.newValue) return false;
        const last = lastPart(c.attribute).toLowerCase();
        return (last === 'identifiers' || last === 'principal') && /"\*"/.test(c.newValue);
      })
        ? 'IAM wildcard principal'
        : null,
    level: 'high',
    isDestructive: false,
  },
  {
    test: (change) =>
      change.changes.some((c) => {
        if (!c.newValue) return false;
        return c.attribute.split('.')[0] === 'ingress' && /0\.0\.0\.0\/0/.test(c.newValue);
      })
        ? 'Open security group ingress (0.0.0.0/0)'
        : null,
    level: 'high',
    isDestructive: false,
  },
  {
    test: (change) =>
      change.changes.some((c) => {
        if (!c.newValue) return false;
        return c.attribute.split('.')[0] === 'egress' && /0\.0\.0\.0\/0/.test(c.newValue);
      })
        ? 'Open security group egress (0.0.0.0/0)'
        : null,
    level: 'medium',
    isDestructive: false,
  },
  {
    test: (change) =>
      change.changes.some((c) => {
        if (!c.newValue) return false;
        return lastPart(c.attribute) === 'force_destroy' && /^true$/.test(c.newValue.trim());
      })
        ? 'force_destroy enabled'
        : null,
    level: 'high',
    isDestructive: false,
  },
  {
    test: (change) => (change.action === 'delete' ? 'Resource deletion' : null),
    level: 'high',
    isDestructive: true,
  },
];

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  return rank[b] > rank[a] ? b : a;
}

function classifyRisks(changes: ResourceChange[]): ResourceChange[] {
  return changes.map((change) => {
    let level: RiskLevel = 'low';
    const reasons: string[] = [];
    let isDestructive = change.riskProfile.isDestructive;
    for (const rule of RULES) {
      const reason = rule.test(change);
      if (reason !== null) {
        level = maxRisk(level, rule.level);
        reasons.push(reason);
        if (rule.isDestructive) isDestructive = true;
      }
    }
    return { ...change, riskProfile: { level, reasons, isDestructive } };
  });
}

// =============================================================================
// SECTION 6: REFERENCE PARSER  (src/content/refParser.ts)
// =============================================================================

function buildDependencyGraph(changes: ResourceChange[]): DependencyGraph {
  const graph: DependencyGraph = new Map();
  if (changes.length === 0) return graph;

  const idPatterns = new Map<string, RegExp>(
    changes.map((c) => [c.id, new RegExp(c.id.replace(/\./g, '\\.') + '\\b')])
  );

  for (const change of changes) {
    const deps = new Set<string>();
    for (const attr of change.changes) {
      if (!attr.newValue) continue;
      for (const [otherId, pattern] of idPatterns) {
        if (otherId === change.id) continue;
        if (pattern.test(attr.newValue)) deps.add(otherId);
      }
    }
    graph.set(change.id, deps);
  }
  return graph;
}

// =============================================================================
// SECTION 7: AI SUMMARY  (src/content/aiSummary.ts)
// =============================================================================

async function generateDiffHash(changes: ResourceChange[]): Promise<string> {
  const CACHE_VERSION = 'v2';
  const simplified = changes.map((c) => ({
    id: c.id,
    action: c.action,
    attrs: c.changes.map((a) =>
      a.isSensitive ? `${a.attribute}:<sensitive>` : `${a.attribute}:${a.newValue ?? ''}`
    ),
  }));
  const msgBuffer = new TextEncoder().encode(JSON.stringify(simplified) + CACHE_VERSION);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildPrompt(changes: ResourceChange[]): string {
  const changeList = changes
    .map((c) => {
      const risk = c.riskProfile.level.toUpperCase();
      const reasons = c.riskProfile.reasons.length ? ` (${c.riskProfile.reasons.join(', ')})` : '';
      const attrs = c.changes
        .filter((a) => !a.isSensitive)
        .slice(0, 3)
        .map((a) => `${a.attribute}=${a.newValue}`)
        .join(', ');
      return `- ${c.action.toUpperCase()} ${c.id} [${risk}${reasons}]: ${attrs}`;
    })
    .join('\n');

  return `You are a Terraform diff reviewer. Analyze these resource changes and respond with valid JSON only.

Changes:
${changeList}

Respond with exactly this JSON schema:
{"summary":"...","risks":["..."],"rollback":["step 1...","step 2..."],"prDescription":"..."}

Rules:
1. summary: 2-4 sentences explaining the high-level impact.
2. risks: Max 3 specific security or operational risks, each prefixed [HIGH], [MEDIUM], or [LOW].
3. rollback: Max 6 concrete ordered steps to safely revert these changes.
4. prDescription: Markdown PR description with sections ## Summary, ## Changes, ## Risk Assessment, ## Pre-merge Checklist (with checkbox items).
5. Respond ONLY with the JSON object.`;
}

async function fetchAISummary(changes: ResourceChange[]): Promise<AISummaryResult | null> {
  try {
    const prompt = buildPrompt(changes);
    // Routed through background service worker — content scripts can be blocked by the host page CSP
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_AI_SUMMARY',
      payload: { prompt, model: 'claude-haiku-4-5-20251001' },
    });
    if (!response || response.error) throw new Error(response?.error || 'Empty response');
    if (!Array.isArray(response.content) || !response.content[0]?.text)
      throw new Error('Unexpected response format');
    const parsed = JSON.parse(response.content[0].text);
    if (
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.risks) ||
      !Array.isArray(parsed.rollback) ||
      typeof parsed.prDescription !== 'string'
    ) {
      throw new Error('Invalid AI response shape');
    }
    return parsed as AISummaryResult;
  } catch (error) {
    console.error('TFE: AI Summary failed', error);
    return null;
  }
}

// =============================================================================
// SECTION 8: MINIMAP RENDERER  (src/content/sidebar/minimap.ts)
// =============================================================================

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_W = 120,
  NODE_H = 24,
  ROW_H = 32;
const COL_X_LEFT = 0,
  COL_X_RIGHT = 160,
  CANVAS_W = 280,
  PADDING = 8,
  ARROW_SIZE = 5;

const RISK_CLASS: Record<RiskLevel | 'unknown', string> = {
  high: 'tfe-node-high',
  medium: 'tfe-node-medium',
  low: 'tfe-node-low',
  unknown: 'tfe-node-unknown',
};

function svgCreate(tag: string): Element {
  return document.createElementNS(SVG_NS, tag);
}
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function renderMinimap(changes: ResourceChange[], graph: DependencyGraph): SVGSVGElement {
  const svg = svgCreate('svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(CANVAS_W));

  if (changes.length === 0) {
    svg.setAttribute('height', '0');
    return svg as SVGSVGElement;
  }

  const rightIds = new Set<string>();
  for (const [id, deps] of graph) {
    if (deps.size > 0) rightIds.add(id);
  }

  const leftNodes = changes.filter((c) => !rightIds.has(c.id));
  const rightNodes = changes.filter((c) => rightIds.has(c.id));
  const hasEdges = rightNodes.length > 0 && leftNodes.length > 0;

  const positions = new Map<string, { x: number; y: number }>();
  if (!hasEdges) {
    const cx = Math.round((CANVAS_W - NODE_W) / 2);
    changes.forEach((c, i) => positions.set(c.id, { x: cx, y: PADDING + i * ROW_H }));
  } else {
    leftNodes.forEach((c, i) => positions.set(c.id, { x: COL_X_LEFT, y: PADDING + i * ROW_H }));
    rightNodes.forEach((c, i) => positions.set(c.id, { x: COL_X_RIGHT, y: PADDING + i * ROW_H }));
  }

  const rowCount = hasEdges ? Math.max(leftNodes.length, rightNodes.length) : changes.length;
  svg.setAttribute('height', String(PADDING + rowCount * ROW_H - (ROW_H - NODE_H) + PADDING));

  if (hasEdges) {
    for (const [srcId, deps] of graph) {
      if (deps.size === 0) continue;
      const srcPos = positions.get(srcId);
      if (!srcPos) continue;
      for (const depId of deps) {
        const depPos = positions.get(depId);
        if (!depPos || srcPos.x === depPos.x) continue;
        const x1 = srcPos.x,
          y1 = srcPos.y + NODE_H / 2;
        const x2 = depPos.x + NODE_W,
          y2 = depPos.y + NODE_H / 2;
        const line = svgCreate('line');
        line.setAttribute('class', 'tfe-edge');
        line.setAttribute('data-from', srcId);
        line.setAttribute('data-to', depId);
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        svg.appendChild(line);
        const arrow = svgCreate('polygon');
        arrow.setAttribute('class', 'tfe-edge-arrow');
        arrow.setAttribute('data-from', srcId);
        arrow.setAttribute('data-to', depId);
        arrow.setAttribute(
          'points',
          `${x2},${y2} ${x2 + ARROW_SIZE},${y2 - ARROW_SIZE / 2} ${x2 + ARROW_SIZE},${y2 + ARROW_SIZE / 2}`
        );
        svg.appendChild(arrow);
      }
    }
  }

  for (const change of changes) {
    const pos = positions.get(change.id);
    if (!pos) continue;
    const level = change.riskProfile.level in RISK_CLASS ? change.riskProfile.level : 'unknown';
    const g = svgCreate('g');
    g.setAttribute('data-id', change.id);
    const title = svgCreate('title');
    title.textContent = change.id;
    g.appendChild(title);
    const rect = svgCreate('rect');
    rect.setAttribute('class', `tfe-node-rect ${RISK_CLASS[level as RiskLevel]}`);
    rect.setAttribute('x', String(pos.x));
    rect.setAttribute('y', String(pos.y));
    rect.setAttribute('width', String(NODE_W));
    rect.setAttribute('height', String(NODE_H));
    rect.setAttribute('rx', '4');
    g.appendChild(rect);
    const label = svgCreate('text');
    label.setAttribute('class', 'tfe-node-label');
    label.setAttribute('x', String(pos.x + 6));
    label.setAttribute('y', String(pos.y + 14));
    label.textContent = truncate(change.name, 15);
    g.appendChild(label);
    const sub = svgCreate('text');
    sub.setAttribute('class', 'tfe-node-sublabel');
    sub.setAttribute('x', String(pos.x + 6));
    sub.setAttribute('y', String(pos.y + 22));
    sub.textContent = truncate(change.type, 20);
    g.appendChild(sub);
    svg.appendChild(g);
  }
  return svg as SVGSVGElement;
}

// =============================================================================
// SECTION 9: SIDEBAR  (src/content/sidebar/index.ts)
// =============================================================================

const SIDEBAR_ID = 'tf-diff-explainer-sidebar';
let highlightController: AbortController | null = null;

function getRelated(activeId: string, graph: DependencyGraph): Set<string> {
  const related = new Set<string>();
  const deps = graph.get(activeId);
  if (deps) for (const d of deps) related.add(d);
  for (const [id, targets] of graph) {
    if (targets.has(activeId)) related.add(id);
  }
  return related;
}

function clearHighlight(sidebar: HTMLElement): void {
  delete sidebar.dataset.activeId;
  for (const el of sidebar.querySelectorAll(
    '.tfe-active, .tfe-related, .tfe-node-active, .tfe-node-related, .tfe-edge-active, .tfe-arrow-active'
  )) {
    el.classList.remove(
      'tfe-active',
      'tfe-related',
      'tfe-node-active',
      'tfe-node-related',
      'tfe-edge-active',
      'tfe-arrow-active'
    );
  }
}

function applyHighlight(sidebar: HTMLElement, activeId: string, graph: DependencyGraph): void {
  clearHighlight(sidebar);
  sidebar.dataset.activeId = activeId;
  const related = getRelated(activeId, graph);
  for (const card of sidebar.querySelectorAll<HTMLElement>('.tfe-card[data-resource-id]')) {
    const id = card.dataset.resourceId!;
    if (id === activeId) card.classList.add('tfe-active');
    else if (related.has(id)) card.classList.add('tfe-related');
  }
  for (const g of sidebar.querySelectorAll<Element>('g[data-id]')) {
    const id = g.getAttribute('data-id')!;
    if (id === activeId) g.classList.add('tfe-node-active');
    else if (related.has(id)) g.classList.add('tfe-node-related');
  }
  for (const edge of sidebar.querySelectorAll<Element>('line[data-from], polygon[data-from]')) {
    const from = edge.getAttribute('data-from')!;
    const to = edge.getAttribute('data-to')!;
    if (from === activeId || to === activeId) {
      edge.classList.add(edge.tagName === 'line' ? 'tfe-edge-active' : 'tfe-arrow-active');
    }
  }
}

function setupHighlighting(sidebar: HTMLElement, body: HTMLElement, graph: DependencyGraph): void {
  highlightController?.abort();
  highlightController = new AbortController();
  const { signal } = highlightController;
  body.addEventListener(
    'mouseover',
    (e) => {
      const card = (e.target as Element).closest<HTMLElement>('.tfe-card[data-resource-id]');
      if (!card) return;
      const id = card.dataset.resourceId!;
      if (sidebar.dataset.activeId === id) return;
      applyHighlight(sidebar, id, graph);
    },
    { signal }
  );
  sidebar.addEventListener('mouseleave', () => clearHighlight(sidebar), { signal });
}

function injectSidebar(): void {
  if (document.getElementById(SIDEBAR_ID)) return;
  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  const header = document.createElement('div');
  header.className = 'tfe-header';
  const title = document.createElement('span');
  title.className = 'tfe-title';
  title.textContent = 'TF Diff Explainer';
  const btn = document.createElement('button');
  btn.className = 'tfe-toggle';
  btn.setAttribute('aria-label', 'Collapse sidebar');
  btn.textContent = '✕';
  header.appendChild(title);
  header.appendChild(btn);
  const body = document.createElement('div');
  body.className = 'tfe-body';
  const skeleton = document.createElement('div');
  skeleton.className = 'tfe-skeleton';
  for (const short of [false, true, false, true]) {
    const line = document.createElement('div');
    line.className = short ? 'tfe-skeleton-line short' : 'tfe-skeleton-line';
    skeleton.appendChild(line);
  }
  body.appendChild(skeleton);
  sidebar.appendChild(header);
  sidebar.appendChild(body);
  document.body.appendChild(sidebar);
  btn.addEventListener('click', () => {
    sidebar.classList.toggle('tfe-collapsed');
    const collapsed = sidebar.classList.contains('tfe-collapsed');
    btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    btn.textContent = collapsed ? '❯' : '✕';
  });
}

function updateSidebar(results: ResourceChange[]): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;
  const body = sidebar.querySelector<HTMLElement>('.tfe-body');
  if (!body) return;
  body.textContent = '';
  if (results.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'tfe-empty';
    empty.textContent = 'No Terraform changes detected.';
    body.appendChild(empty);
    return;
  }
  for (const change of results) {
    const card = document.createElement('div');
    card.className = `tfe-card tfe-risk-${change.riskProfile.level}`;
    card.dataset.resourceId = change.id;
    const cardHeader = document.createElement('div');
    cardHeader.className = 'tfe-card-header';
    const cardTitle = document.createElement('span');
    cardTitle.className = 'tfe-card-title';
    cardTitle.textContent = change.id;
    const badge = document.createElement('span');
    badge.className = `tfe-card-badge tfe-risk-${change.riskProfile.level}`;
    badge.textContent = change.riskProfile.level.toUpperCase();
    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(badge);
    card.appendChild(cardHeader);
    if (change.riskProfile.reasons.length > 0) {
      const reasonList = document.createElement('ul');
      reasonList.className = 'tfe-card-reasons';
      for (const reason of change.riskProfile.reasons) {
        const item = document.createElement('li');
        item.className = 'tfe-card-reason';
        item.textContent = reason;
        reasonList.appendChild(item);
      }
      card.appendChild(reasonList);
    }
    body.appendChild(card);
  }
}

function updateMinimap(changes: ResourceChange[], graph: DependencyGraph): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;
  const body = sidebar.querySelector<HTMLElement>('.tfe-body');
  if (!body) return;
  body.querySelector('.tfe-minimap-section')?.remove();
  if (changes.length === 0) return;
  const section = document.createElement('div');
  section.className = 'tfe-minimap-section';
  const heading = document.createElement('p');
  heading.className = 'tfe-minimap-heading';
  heading.textContent = 'Resource Graph';
  section.appendChild(heading);
  const svgNode = renderMinimap(changes, graph);
  if (Number(svgNode.getAttribute('height')) > 0) section.appendChild(svgNode);
  body.appendChild(section);
  setupHighlighting(sidebar, body, graph);
}

function removeSidebar(): void {
  document.getElementById(SIDEBAR_ID)?.remove();
}

function updateAISummary(state: AISummaryResult | null | 'loading' | 'no-key' | 'error'): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;
  const body = sidebar.querySelector<HTMLElement>('.tfe-body');
  if (!body) return;
  body.querySelector('.tfe-ai-section')?.remove();
  if (state === null) return;
  const section = document.createElement('div');
  section.className = 'tfe-ai-section';
  const heading = document.createElement('p');
  heading.className = 'tfe-ai-heading';
  heading.textContent = 'AI Summary';
  section.appendChild(heading);
  if (state === 'loading') {
    const skeleton = document.createElement('div');
    skeleton.className = 'tfe-skeleton';
    for (const short of [false, false, true]) {
      const line = document.createElement('div');
      line.className = short ? 'tfe-skeleton-line short' : 'tfe-skeleton-line';
      skeleton.appendChild(line);
    }
    section.appendChild(skeleton);
  } else if (state === 'no-key') {
    const msg = document.createElement('p');
    msg.className = 'tfe-ai-cta';
    msg.textContent = 'Click the extension icon ↗ to set up AI summaries.';
    section.appendChild(msg);
  } else if (state === 'error') {
    const msg = document.createElement('p');
    msg.className = 'tfe-ai-error';
    msg.textContent = 'AI summary unavailable.';
    section.appendChild(msg);
  } else {
    const summary = document.createElement('p');
    summary.className = 'tfe-ai-summary';
    summary.textContent = state.summary;
    section.appendChild(summary);
    if (state.risks.length > 0) {
      const riskHeading = document.createElement('p');
      riskHeading.className = 'tfe-ai-subheading';
      riskHeading.textContent = 'Risks';
      section.appendChild(riskHeading);
      const riskList = document.createElement('ul');
      riskList.className = 'tfe-ai-list';
      for (const risk of state.risks) {
        const item = document.createElement('li');
        item.textContent = risk;
        riskList.appendChild(item);
      }
      section.appendChild(riskList);
    }
    if (state.rollback.length > 0) {
      const rollbackHeading = document.createElement('p');
      rollbackHeading.className = 'tfe-ai-subheading';
      rollbackHeading.textContent = 'Rollback Checklist';
      section.appendChild(rollbackHeading);
      const rollbackList = document.createElement('ol');
      rollbackList.className = 'tfe-ai-rollback';
      rollbackList.setAttribute('aria-label', 'Rollback checklist');
      for (const step of state.rollback) {
        const item = document.createElement('li');
        item.className = 'tfe-ai-rollback-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tfe-ai-rollback-check';
        checkbox.setAttribute('aria-label', 'Mark step complete');
        const text = document.createElement('span');
        text.textContent = step;
        item.appendChild(checkbox);
        item.appendChild(text);
        rollbackList.appendChild(item);
      }
      section.appendChild(rollbackList);
    }
    if (state.prDescription) {
      const prHeading = document.createElement('p');
      prHeading.className = 'tfe-ai-subheading';
      prHeading.textContent = 'PR Description';
      section.appendChild(prHeading);
      const prHeader = document.createElement('div');
      prHeader.className = 'tfe-ai-pr-header';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'tfe-ai-copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', 'Copy PR description');
      const prDescText = state.prDescription;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard
          .writeText(prDescText)
          .then(() => {
            copyBtn.textContent = 'Copied ✓';
            setTimeout(() => {
              copyBtn.textContent = 'Copy';
            }, 1500);
          })
          .catch(() => {});
      });
      prHeader.appendChild(copyBtn);
      section.appendChild(prHeader);
      const prPre = document.createElement('pre');
      prPre.className = 'tfe-ai-pr-desc';
      prPre.textContent = state.prDescription;
      section.appendChild(prPre);
    }
  }
  body.appendChild(section);
}

// =============================================================================
// SECTION 10: CONTENT SCRIPT ORCHESTRATOR  (src/content/index.ts)
// =============================================================================

(async function init() {
  const host = location.hostname;
  let generation = 0;

  const runAnalysis = async () => {
    const gen = ++generation;

    if (!hasTerraformDiff()) {
      await clearCachedAnalysis(location.href);
      return;
    }

    injectSidebar();

    const cached = await getCachedAnalysis(location.href);
    let changes, graph;

    if (cached) {
      ({ changes, graph } = cached);
    } else {
      changes = classifyRisks(await parseDiff());
      graph = buildDependencyGraph(changes);
      await setCachedAnalysis(location.href, changes, graph);
    }

    if (gen !== generation) return;
    updateSidebar(changes);
    updateMinimap(changes, graph);

    if (changes.length === 0) return;

    const apiKey = await getApiKey();
    if (!apiKey) {
      updateAISummary('no-key');
      return;
    }

    if (gen !== generation) return;
    const hash = await generateDiffHash(changes);
    const cachedAI = await getCachedAISummary(hash);
    if (cachedAI) {
      if (gen !== generation) return;
      updateAISummary(cachedAI);
      return;
    }

    if (gen !== generation) return;
    updateAISummary('loading');
    const aiResult = await fetchAISummary(changes);

    if (gen !== generation) return;
    if (aiResult) {
      try {
        await setCachedAISummary(hash, aiResult);
      } catch (error) {
        console.warn('TFE: Failed to cache AI summary', error);
      }
    }
    updateAISummary(aiResult ?? 'error');
  };

  try {
    if (!isSupportedPage()) return;
    const enabled = await isEnabledForHost(host);
    if (!enabled) return;

    await runAnalysis();

    let navObserver: MutationObserver | null = null;

    // GitHub uses Turbo/pjax; GitLab uses Vue router — both mutate DOM without a full reload
    watchForNavigation(async (newUrl: string) => {
      removeSidebar();
      if (navObserver) navObserver.disconnect();
      if (!isSupportedPage(newUrl)) return;
      const stillEnabled = await isEnabledForHost(host);
      if (!stillEnabled) return;
      navObserver = new MutationObserver((_, obs) => {
        if (hasTerraformDiff()) {
          obs.disconnect();
          runAnalysis();
        }
      });
      navObserver.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => navObserver?.disconnect(), 5000);
    });
  } catch {
    // Swallow silently — errors must not surface to the host PR page
  }
})();

// =============================================================================
// SECTION 11: BACKGROUND SERVICE WORKER  (src/background/index.ts)
// =============================================================================

// NOTE: In the real build this is a separate bundle. Chrome MV3 requires the
// service worker to be its own file. This section is here for reading only.

/*
void chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({ enabled: true, disabledHosts: [], apiKey: null });
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#0969da' });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'FETCH_AI_SUMMARY') return false;
  const { prompt, model } = message.payload as { prompt: string; model: string };
  void (async () => {
    try {
      const apiKey = await getApiKey();
      if (!apiKey) { sendResponse({ error: 'Missing API key' }); return; }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 768, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) { const body = await res.json().catch(() => null); sendResponse({ error: body?.error?.message ?? `HTTP ${res.status}` }); return; }
      sendResponse(await res.json());
    } catch (err) { sendResponse({ error: err instanceof Error ? err.message : 'Unknown error' }); }
  })();
  return true;
});
*/

// =============================================================================
// SECTION 12: POPUP  (src/popup/popup.ts)
// =============================================================================

// NOTE: In the real build this runs in the popup page context, not the content
// script. This section is here for reading only.

/*
const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

async function getCurrentHost(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? new URL(tab.url).hostname : null;
}

async function initPopup(): Promise<void> {
  const [apiKey, managed] = await Promise.all([getApiKey(), isManagedApiKey()]);
  const keyInput = document.getElementById('api-key') as HTMLInputElement;
  const keyStatus = document.getElementById('key-status') as HTMLParagraphElement;
  const saveBtn = document.getElementById('save-key') as HTMLButtonElement;
  const banner = document.getElementById('onboarding-banner') as HTMLElement;

  if (managed) {
    keyInput.value = apiKey ?? ''; keyInput.disabled = true; saveBtn.disabled = true;
    keyStatus.textContent = 'This setting is managed by your organization.'; keyStatus.className = 'hint';
  } else if (apiKey) {
    keyInput.value = apiKey; keyStatus.textContent = 'Key saved.'; keyStatus.className = 'hint success';
  } else {
    banner.style.display = 'block';
  }

  if (!managed) {
    saveBtn.addEventListener('click', async () => {
      const val = keyInput.value.trim();
      if (!ANTHROPIC_KEY_RE.test(val)) { keyStatus.textContent = 'Invalid key format. Must start with sk-ant-'; keyStatus.className = 'hint error'; return; }
      await chrome.storage.local.set({ apiKey: val });
      keyStatus.textContent = 'Key saved.'; keyStatus.className = 'hint success';
      banner.style.display = 'none'; chrome.action.setBadgeText({ text: '' });
    });
  }

  const host = await getCurrentHost();
  const siteHint = document.getElementById('site-hint') as HTMLParagraphElement;
  const siteToggle = document.getElementById('site-toggle') as HTMLInputElement;
  if (!host) { siteHint.textContent = 'Not on a supported page.'; siteToggle.disabled = true; return; }
  siteHint.textContent = host;
  const [enabled, managedHosts] = await Promise.all([isEnabledForHost(host), isManagedDisabledHosts()]);
  siteToggle.checked = enabled;
  if (managedHosts) {
    siteToggle.disabled = true; siteHint.textContent = `${host} — managed by your organization`;
  } else {
    siteToggle.addEventListener('change', async () => {
      const { disabledHosts: current = [] } = await chrome.storage.local.get('disabledHosts');
      const updated = siteToggle.checked ? (current as string[]).filter((h) => h !== host) : [...new Set([...(current as string[]), host])];
      await chrome.storage.local.set({ disabledHosts: updated });
    });
  }
}

initPopup();
*/
