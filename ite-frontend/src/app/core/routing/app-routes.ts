/**
 * Single source of truth for every route path in the app.
 * Use these helpers instead of hand-writing route arrays — a rename
 * becomes one file change instead of a grep-and-pray.
 *
 * Each helper returns a RouterLink-compatible array.
 */
export const AppRoutes = {
  dashboard: (): string[] => ['/dashboard'],
  upload: (): string[] => ['/upload'],
  uploadTenderBidders: (tenderId: string): string[] => [
    '/upload',
    tenderId,
    'bidders',
  ],
  evaluations: (): string[] => ['/evaluations'],
  tenders: (): string[] => ['/tenders'],
  tenderBidders: (tenderId: string): string[] => [
    '/tenders',
    tenderId,
    'bidders',
  ],
  bidderEvaluation: (tenderId: string, bidderId: string): string[] => [
    '/tenders',
    tenderId,
    'bidders',
    bidderId,
    'evaluation',
  ],
  uploadBidderEvaluation: (tenderId: string, bidderId: string): string[] => [
    '/upload',
    tenderId,
    'bidders',
    bidderId,
    'evaluation',
  ],
  bidderDocuments: (tenderId: string, bidderId: string): string[] => [
    '/tenders',
    tenderId,
    'bidders',
    bidderId,
    'documents',
  ],
} as const;

/**
 * Path templates used in app.routes.ts. Keep segment tokens in sync
 * with the helpers above so a rename touches one file.
 */
export const RoutePaths = {
  DASHBOARD: 'dashboard',
  UPLOAD: 'upload',
  UPLOAD_TENDER_BIDDERS: 'upload/:tenderId/bidders',
  EVALUATIONS: 'evaluations',
  TENDERS: 'tenders',
  TENDER_BIDDERS: 'tenders/:tenderId/bidders',
  BIDDER_EVALUATION: 'tenders/:tenderId/bidders/:bidderId/evaluation',
  UPLOAD_BIDDER_EVALUATION: 'upload/:tenderId/bidders/:bidderId/evaluation',
  BIDDER_DOCUMENTS: 'tenders/:tenderId/bidders/:bidderId/documents',
  AUDIT_LOGS: 'audit-logs',
} as const;
