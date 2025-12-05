export type ReviewSeverity = "critical" | "warning" | "info";

export interface ReviewConcern {
	severity: ReviewSeverity;
	file: string;
	line?: number;
	title: string;
	description: string;
	suggestion?: string;
}

export interface ReviewResult {
	concerns: ReviewConcern[];
	positives: string[];
	summary: string;
	recommendation: "approve" | "request-changes" | "comment";
}

export interface ConflictBlock {
	file: string;
	startLine: number;
	mainVersion: string;
	featureVersion: string;
}

export interface ConflictResolution {
	file: string;
	analysis: string;
	suggestedResolution: string;
	confidence: number;
	reasoning: string;
}
