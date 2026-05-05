export type TenderStatus =
  | 'Pending Review'
  | 'Technical Evaluation'
  | 'Financial Comparison'
  | 'Award Recommended'
  | 'On Hold'
  | 'Closed';

export type CriterionStatus = 'passed' | 'failed' | 'partial';

export type CriterionCategory =
  | 'Eligibility'
  | 'Technical'
  | 'Financial'
  | 'Compliance';

export type BidderOverallStatus =
  | 'Qualified'
  | 'Disqualified'
  | 'Under Review';

export interface ProcessedTender {
  id: string;
  reference: string;
  name: string;
  authority: string;
  uploadedDate: string;
  closingDate: string;
  status: TenderStatus;
  biddersCount: number;
  documentName: string;
  documentSize: string;
  estimatedValue: string;
  description: string;
}

export interface DocumentEvidence {
  documentName: string;
  pageOrSection: string;
  excerpt: string;
  extractedValue?: string;
  confidence: number;
}

export interface EvaluationCriterion {
  id: string;
  category: CriterionCategory;
  title: string;
  requirement: string;
  status: CriterionStatus;
  weight: number;
  score: number;
  evidence: DocumentEvidence[];
  notes?: string;
}

/**
 * Slim bidder payload suitable for list views. Does not include the
 * full criteria tree — fetch via BidderRepository.getEvaluation() when
 * you need the full evaluation.
 */
export interface BidderSummary {
  id: string;
  tenderId: string;
  name: string;
  registrationNo: string;
  submittedOn: string;
  documentsCount: number;
  totalSize: string;
  confidenceScore: number;
  rank: number;
  overallStatus: BidderOverallStatus;
  technicalScore: number;
  financialScore: number;
  complianceScore: number;
  bidAmount: string;
}

/**
 * Full bidder evaluation with criteria + evidence — used by the
 * evaluation report page only.
 */
export interface BidderEvaluation extends BidderSummary {
  criteria: EvaluationCriterion[];
}

/**
 * @deprecated Prefer BidderSummary for list contexts,
 * BidderEvaluation for report contexts.
 */
export type Bidder = BidderEvaluation;
