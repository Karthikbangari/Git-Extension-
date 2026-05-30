export interface FileContent {
  filePath: string;
  language: string;
  lines: string[];
}

export interface FileSummaryResult {
  summary: string;
  keyPoints: string[];
  complexity: 'low' | 'medium' | 'high';
}
