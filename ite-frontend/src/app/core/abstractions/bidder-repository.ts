import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BidderEvaluation,
  BidderSummary,
} from '../models/evaluation.models';

export interface BidderRepository {
  listForTender(tenderId: string): Observable<BidderSummary[]>;
  getEvaluation(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderEvaluation | undefined>;
}

export const BIDDER_REPOSITORY = new InjectionToken<BidderRepository>(
  'BIDDER_REPOSITORY',
);
