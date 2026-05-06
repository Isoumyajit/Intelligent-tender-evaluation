import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AddBidderPayload,
  BidderRepository,
} from '../abstractions/bidder-repository';
import {
  BidderDocument,
  BidderEvaluation,
  BidderSummary,
} from '../models/evaluation.models';
import { RefreshBus } from './refresh-bus';

/**
 * HTTP-backed BidderRepository. After a successful write the repo fires
 * RefreshBus.tenders$ so every consumer piped through it re-reads
 * automatically — same contract the mock honoured.
 */
@Injectable({ providedIn: 'root' })
export class HttpBidderRepository implements BidderRepository {
  private readonly http = inject(HttpClient);
  private readonly refresh = inject(RefreshBus);
  private readonly base = environment.apiBaseUrl;

  listForTender(tenderId: string): Observable<BidderSummary[]> {
    return this.http.get<BidderSummary[]>(
      `${this.base}/tenders/${encodeURIComponent(tenderId)}/bidders`,
    );
  }

  getEvaluation(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderEvaluation | undefined> {
    return this.http.get<BidderEvaluation>(
      `${this.base}/tenders/${encodeURIComponent(tenderId)}/bidders/${encodeURIComponent(bidderId)}/evaluation`,
    );
  }

  listDocuments(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderDocument[]> {
    return this.http.get<BidderDocument[]>(
      `${this.base}/tenders/${encodeURIComponent(tenderId)}/bidders/${encodeURIComponent(bidderId)}/documents`,
    );
  }

  addBidderToTender(
    tenderId: string,
    payload: AddBidderPayload,
  ): Observable<BidderSummary> {
    return this.http
      .post<BidderSummary>(
        `${this.base}/tenders/${encodeURIComponent(tenderId)}/bidders`,
        payload,
      )
      .pipe(tap(() => this.refresh.emitTendersChanged()));
  }
}
