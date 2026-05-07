import { TenderStatus } from '../models/evaluation.models';

export type TenderStatusTone =
  | 'ite-status--neutral'
  | 'ite-status--partial'
  | 'ite-status--pass'
  | 'ite-status--fail';

export interface TenderStatusDescriptor {
  status: TenderStatus;
  /** Clerk-friendly short label. */
  label: string;
  /** Rich sentence describing the next step a clerk should take. */
  nextStep: string;
  /** Verb for the CTA button. */
  actionLabel: string;
  /** Material Icon Ligature for the action. */
  actionIcon: string;
  /** CSS class key toggling Material status tokens. */
  tone: TenderStatusTone;
  /**
   * What the action button should do. `'add-bidder-dialog'` opens the
   * bidder-upload dialog inline (no navigation); the others resolve via
   * AppRoutes.
   */
  actionRoute:
    | 'upload'
    | 'tender-bidders'
    | 'add-bidder-dialog'
    | 'none';
  /** Bucket used by dashboard "Your work today" quick stats. */
  bucket:
    | 'waiting-for-bidders'
    | 'ready-to-evaluate'
    | 'being-evaluated'
    | 'ready-for-review'
    | 'closed'
    | 'other';
}

export const TENDER_STATUS_DESCRIPTORS: readonly TenderStatusDescriptor[] = [
  {
    status: 'Pending Review',
    label: 'Pending Review',
    nextStep: 'Add bidder submissions to start evaluation.',
    actionLabel: 'Add bidders',
    actionIcon: 'person_add',
    tone: 'ite-status--partial',
    actionRoute: 'add-bidder-dialog',
    bucket: 'waiting-for-bidders',
  },
  {
    status: 'Technical Evaluation',
    label: 'Technical Evaluation',
    nextStep: 'AI is evaluating documents. You can view progress.',
    actionLabel: 'See progress',
    actionIcon: 'visibility',
    tone: 'ite-status--neutral',
    actionRoute: 'tender-bidders',
    bucket: 'being-evaluated',
  },
  {
    status: 'Financial Comparison',
    label: 'Financial Comparison',
    nextStep: 'Evaluation finished. Please review the bidders.',
    actionLabel: 'Review bidders',
    actionIcon: 'rate_review',
    tone: 'ite-status--pass',
    actionRoute: 'tender-bidders',
    bucket: 'ready-for-review',
  },
  {
    status: 'Award Recommended',
    label: 'Award Recommended',
    nextStep: 'Evaluation finished. Please review the bidders.',
    actionLabel: 'Review bidders',
    actionIcon: 'rate_review',
    tone: 'ite-status--pass',
    actionRoute: 'tender-bidders',
    bucket: 'ready-for-review',
  },
  {
    status: 'On Hold',
    label: 'On Hold',
    nextStep: 'Tender temporarily paused. No action required.',
    actionLabel: 'Open',
    actionIcon: 'pause_circle',
    tone: 'ite-status--neutral',
    actionRoute: 'tender-bidders',
    bucket: 'other',
  },
  {
    status: 'Closed',
    label: 'Closed',
    nextStep: 'Tender fully processed.',
    actionLabel: 'Open',
    actionIcon: 'check_circle',
    tone: 'ite-status--neutral',
    actionRoute: 'tender-bidders',
    bucket: 'closed',
  },
] as const;

const descriptorByStatus = new Map(
  TENDER_STATUS_DESCRIPTORS.map((d) => [d.status, d] as const),
);

const fallback: TenderStatusDescriptor = {
  status: 'Pending Review',
  label: 'Unknown',
  nextStep: 'View details.',
  actionLabel: 'Open',
  actionIcon: 'open_in_new',
  tone: 'ite-status--neutral',
  actionRoute: 'tender-bidders',
  bucket: 'other',
};

export function describeStatus(
  status: TenderStatus,
): TenderStatusDescriptor {
  return descriptorByStatus.get(status) ?? fallback;
}

/**
 * Indicative progress percentage for a tender in its current stage. Values
 * are derived from the status only today; when the backend starts emitting a
 * real `progress` field on ProcessedTender, callers should prefer that and
 * fall back to this helper for tenders that don't yet have one.
 */
const stageProgress: Record<TenderStatus, number> = {
  'Pending Review': 10,
  'Technical Evaluation': 55,
  'Financial Comparison': 85,
  'Award Recommended': 100,
  'On Hold': 0,
  Closed: 100,
};

export function progressForStatus(status: TenderStatus): number {
  return stageProgress[status] ?? 0;
}

/**
 * Buckets currently considered "in progress" for the Evaluations dashboard.
 * The single source of truth — dashboard, header badge, evaluations page all
 * read this, so changing what counts as 'in flight' is a one-line edit.
 */
export const IN_PROGRESS_BUCKETS: ReadonlyArray<
  TenderStatusDescriptor['bucket']
> = ['waiting-for-bidders', 'ready-to-evaluate', 'being-evaluated', 'ready-for-review'];

export function isInProgress(status: TenderStatus): boolean {
  return IN_PROGRESS_BUCKETS.includes(describeStatus(status).bucket);
}
