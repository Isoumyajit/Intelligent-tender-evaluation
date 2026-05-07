import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
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

/** Shape from GET /tenders/{id}/bid/ */
interface BidListRow {
  bid_id: string;
  tender_id: string;
  bidder_name: string;
  created_at: string;
  updated_at: string;
}

/** Shape from POST /tenders/{id}/bid/ and GET /tenders/{id}/bid/{bid_id} */
interface BidDetail extends BidListRow {
  attachments: Array<{
    attachment_ref_id: string;
    file_name: string;
    content_type: string;
    created_at: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class HttpBidderRepository implements BidderRepository {
  private readonly http = inject(HttpClient);
  private readonly refresh = inject(RefreshBus);
  private readonly base = environment.apiBaseUrl;

  listForTender(tenderId: string): Observable<BidderSummary[]> {
    return this.http
      .get<BidListRow[]>(
        `${this.base}/tenders/${encodeURIComponent(tenderId)}/bid/`,
      )
      .pipe(map((rows) => rows.map((r) => this.adaptList(r))));
  }

  /**
   * The backend does not expose evaluation criteria/scores today, so the
   * richer evaluation payload is not available. Return undefined and let
   * the report page render its empty state.
   */
  getEvaluation(
    _tenderId: string,
    _bidderId: string,
  ): Observable<BidderEvaluation | undefined> {
    return of(undefined);
  }

  /**
   * The backend stores attachments against a bid but the detailed
   * per-document view (mime, size, category, description) isn't exposed.
   * Return an empty list until that endpoint exists.
   */
  listDocuments(
    _tenderId: string,
    _bidderId: string,
  ): Observable<BidderDocument[]> {
    return of([]);
  }

  addBidderToTender(
    tenderId: string,
    payload: AddBidderPayload,
  ): Observable<BidderSummary> {
    const body = new FormData();
    body.append('bidder_name', payload.bidderName);
    for (const f of payload.files) {
      body.append('documents', f, f.name);
    }

    return this.http
      .post<BidDetail>(
        `${this.base}/tenders/${encodeURIComponent(tenderId)}/bid/`,
        body,
      )
      .pipe(
        map((raw) => this.adaptDetail(raw)),
        tap(() => this.refresh.emitTendersChanged()),
      );
  }

  private adaptList(raw: BidListRow): BidderSummary {
    return {
      id: raw.bid_id,
      tenderId: raw.tender_id,
      name: raw.bidder_name,
      registrationNo: '—',
      submittedOn: raw.created_at.split('T')[0] ?? '',
      documentsCount: 0,
      totalSize: '',
      confidenceScore: 0,
      rank: 0,
      overallStatus: 'Under Review',
      technicalScore: 0,
      financialScore: 0,
      complianceScore: 0,
      bidAmount: '',
    };
  }

  private adaptDetail(raw: BidDetail): BidderSummary {
    return {
      id: raw.bid_id,
      tenderId: raw.tender_id,
      name: raw.bidder_name,
      registrationNo: '—',
      submittedOn: raw.created_at.split('T')[0] ?? '',
      documentsCount: raw.attachments.length,
      totalSize: '',
      confidenceScore: 0,
      rank: 0,
      overallStatus: 'Under Review',
      technicalScore: 0,
      financialScore: 0,
      complianceScore: 0,
      bidAmount: '',
    };
  }
}
