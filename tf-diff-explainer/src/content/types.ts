/**
 * The type of action performed on the Terraform resource.
 */
export type ActionType = 'create' | 'update' | 'delete' | 'replace' | 'unknown';

/**
 * Qualitative risk levels determined by the Local Risk Classifier.
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Represents a single attribute change within a resource block.
 */
export interface AttributeChange {
  attribute: string;
  oldValue?: string;
  newValue?: string;
  isSensitive: boolean;
}

/**
 * The primary data structure for a parsed Terraform resource change.
 * This is populated by the DOM scraper and enriched by the Risk Classifier.
 */
export interface ResourceChange {
  /** Unique identifier from the diff (e.g., "aws_iam_policy.admin_access") */
  id: string;
  type: string;
  name: string;
  action: ActionType;

  /** The file path where this change was found */
  filePath: string;

  /** List of specific attribute modifications parsed from the diff hunks */
  changes: AttributeChange[];

  /** Risk metadata used for sidebar highlighting and scoring */
  riskProfile: {
    level: RiskLevel;
    /** Human-readable reasons for the score (e.g., "Contains wildcard IAM action") */
    reasons: string[];
    /** Whether this change triggers a "destructive" warning (like a resource deletion) */
    isDestructive: boolean;
  };

  /**
   * Reference to the DOM element or a unique selector to allow
   * "Click to jump to file" functionality in the sidebar.
   */
  domReference?: {
    dataFilePath: string;
    anchorId?: string;
  };
}
