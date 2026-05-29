import type { ResourceChange, DependencyGraph, RiskLevel } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_W = 120;
const NODE_H = 24;
const ROW_H = 32;
const COL_X_LEFT = 0;
const COL_X_RIGHT = 160; // 280 canvas - 120 node width
const CANVAS_W = 280;
const PADDING = 8;
const ARROW_SIZE = 5;

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

export function renderMinimap(changes: ResourceChange[], graph: DependencyGraph): SVGSVGElement {
  const svg = svgCreate('svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(CANVAS_W));

  if (changes.length === 0) {
    svg.setAttribute('height', '0');
    return svg as SVGSVGElement;
  }

  // Classify into columns:
  // right = dependents (resources that reference at least one other changed resource)
  // left  = dependency targets + isolated resources
  const rightIds = new Set<string>();
  for (const [id, deps] of graph) {
    if (deps.size > 0) rightIds.add(id);
  }

  const leftNodes = changes.filter((c) => !rightIds.has(c.id));
  const rightNodes = changes.filter((c) => rightIds.has(c.id));
  const hasEdges = rightNodes.length > 0 && leftNodes.length > 0;

  // Assign positions
  const positions = new Map<string, { x: number; y: number }>();

  if (!hasEdges) {
    // Single centred column
    const cx = Math.round((CANVAS_W - NODE_W) / 2);
    changes.forEach((c, i) => {
      positions.set(c.id, { x: cx, y: PADDING + i * ROW_H });
    });
  } else {
    leftNodes.forEach((c, i) => {
      positions.set(c.id, { x: COL_X_LEFT, y: PADDING + i * ROW_H });
    });
    rightNodes.forEach((c, i) => {
      positions.set(c.id, { x: COL_X_RIGHT, y: PADDING + i * ROW_H });
    });
  }

  const rowCount = hasEdges ? Math.max(leftNodes.length, rightNodes.length) : changes.length;
  const svgH = PADDING + rowCount * ROW_H - (ROW_H - NODE_H) + PADDING;
  svg.setAttribute('height', String(svgH));

  // Edges (drawn behind nodes)
  if (hasEdges) {
    for (const [srcId, deps] of graph) {
      if (deps.size === 0) continue;
      const srcPos = positions.get(srcId);
      if (!srcPos) continue;

      for (const depId of deps) {
        const depPos = positions.get(depId);
        if (!depPos) continue;

        // Only draw cross-column edges (right source → left target)
        if (srcPos.x === depPos.x) continue;

        const x1 = srcPos.x; // left edge of right-column source
        const y1 = srcPos.y + NODE_H / 2;
        const x2 = depPos.x + NODE_W; // right edge of left-column target
        const y2 = depPos.y + NODE_H / 2;

        const line = svgCreate('line');
        line.setAttribute('class', 'tfe-edge');
        line.setAttribute('data-from', srcId);
        line.setAttribute('data-to', depId);
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        svg.appendChild(line);

        // Arrowhead pointing left at (x2, y2)
        const ax = x2;
        const ay = y2;
        const ah = ARROW_SIZE;
        const arrow = svgCreate('polygon');
        arrow.setAttribute('class', 'tfe-edge-arrow');
        arrow.setAttribute('data-from', srcId);
        arrow.setAttribute('data-to', depId);
        arrow.setAttribute(
          'points',
          `${ax},${ay} ${ax + ah},${ay - ah / 2} ${ax + ah},${ay + ah / 2}`
        );
        svg.appendChild(arrow);
      }
    }
  }

  // Nodes
  for (const change of changes) {
    const pos = positions.get(change.id);
    if (!pos) continue;

    const level = change.riskProfile.level in RISK_CLASS ? change.riskProfile.level : 'unknown';
    const riskClass = RISK_CLASS[level as RiskLevel];

    const g = svgCreate('g');
    g.setAttribute('data-id', change.id);

    const title = svgCreate('title');
    title.textContent = change.id;
    g.appendChild(title);

    const rect = svgCreate('rect');
    rect.setAttribute('class', `tfe-node-rect ${riskClass}`);
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
