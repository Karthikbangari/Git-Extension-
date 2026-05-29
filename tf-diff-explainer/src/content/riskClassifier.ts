import type { ResourceChange, RiskLevel } from './types';

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
    // actions = ["*"] (HCL) or "Action": "*" (JSON in heredoc)
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
    // identifiers = ["*"] or principal = "*"
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

function max(a: RiskLevel, b: RiskLevel): RiskLevel {
  const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  return rank[b] > rank[a] ? b : a;
}

export function classifyRisks(changes: ResourceChange[]): ResourceChange[] {
  return changes.map((change) => {
    let level: RiskLevel = 'low';
    const reasons: string[] = [];
    let isDestructive = change.riskProfile.isDestructive;

    for (const rule of RULES) {
      const reason = rule.test(change);
      if (reason !== null) {
        level = max(level, rule.level);
        reasons.push(reason);
        if (rule.isDestructive) isDestructive = true;
      }
    }

    return { ...change, riskProfile: { level, reasons, isDestructive } };
  });
}
