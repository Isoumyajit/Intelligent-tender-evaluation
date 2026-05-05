import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BidderDocument,
  BidderEvaluation,
  BidderSummary,
} from '../models/evaluation.models';

/**
 * Payload the UI sends when a new bidder has been added to a tender.
 * The fields are the user-facing inputs the dialog collects; the backend
 * is expected to fill in ranks, scores, and criterion evaluation.
 */
export interface AddBidderPayload {
  bidderName: string;
  uploadMode: 'folder' | 'zip';
  /** Size of the submission in bytes (sum of files). Optional for now. */
  totalSizeBytes?: number;
  /** Count of files submitted. Optional for now. */
  fileCount?: number;
}

export interface BidderRepository {
  listForTender(tenderId: string): Observable<BidderSummary[]>;
  getEvaluation(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderEvaluation | undefined>;
  listDocuments(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderDocument[]>;

  /**
   * Registers a new bidder against a tender. Implementations are responsible
   * for any downstream side-effects (status progression, broadcast of refresh
   * events, etc.) so callers never need to replicate that policy.
   */
  addBidderToTender(
    tenderId: string,
    payload: AddBidderPayload,
  ): Observable<BidderSummary>;
}

export const BIDDER_REPOSITORY = new InjectionToken<BidderRepository>(
  'BIDDER_REPOSITORY',
);
