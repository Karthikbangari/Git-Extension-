import type { ResourceChange, DependencyGraph } from './types';

export function buildDependencyGraph(changes: ResourceChange[]): DependencyGraph {
  const graph: DependencyGraph = new Map();
  if (changes.length === 0) return graph;

  // Pre-compile one regex per id: match the id at a word boundary so that
  // "aws_s3_bucket.data" does not match "aws_s3_bucket.data_backup"
  const idPatterns = new Map<string, RegExp>(
    changes.map((c) => [c.id, new RegExp(c.id.replace(/\./g, '\\.') + '\\b')])
  );

  for (const change of changes) {
    const deps = new Set<string>();

    for (const attr of change.changes) {
      if (!attr.newValue) continue;
      for (const [otherId, pattern] of idPatterns) {
        if (otherId === change.id) continue;
        if (pattern.test(attr.newValue)) {
          deps.add(otherId);
        }
      }
    }

    graph.set(change.id, deps);
  }

  return graph;
}
