export interface FileContent {
  filePath: string;
  language: string;
  lines: string[];
  isBinary?: boolean;
  truncated?: boolean;
  originalLineCount?: number;
}

export interface FileSummaryResult {
  summary: string;
  keyPoints: string[];
  complexity: 'low' | 'medium' | 'high';
  connections?: string[];
  watchOutFor?: string[];
  analogy?: string;
}
