import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
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
      .pipe(
        switchMap((rows) => {
          if (rows.length === 0) return of([]);
          return forkJoin(
            rows.map((r) =>
              this.http
                .get<BidderSummary>(
                  `${this.base}/tenders/${encodeURIComponent(tenderId)}/bid/${encodeURIComponent(r.bid_id)}/evaluation`,
                )
                .pipe(catchError(() => of(this.adaptList(r)))),
            ),
          );
        }),
      );
  }

  getEvaluation(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderEvaluation | undefined> {
    return this.http
      .get<BidderEvaluation>(
        `${this.base}/tenders/${encodeURIComponent(tenderId)}/bid/${encodeURIComponent(bidderId)}/evaluation`,
      )
      .pipe(catchError(() => of(undefined)));
  }

  listDocuments(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderDocument[]> {
    return this.http
      .get<BidDetail>(
        `${this.base}/tenders/${encodeURIComponent(tenderId)}/bid/${encodeURIComponent(bidderId)}`,
      )
      .pipe(
        map((detail) =>
          (detail.attachments ?? []).map((att) => ({
            id: att.attachment_ref_id,
            tenderId,
            bidderId,
            fileName: att.file_name,
            mimeType: att.content_type,
            sizeBytes: 0,
            uploadedOn: att.created_at.split('T')[0] ?? '',
            category: 'Other' as const,
          })),
        ),
        catchError(() => of([])),
      );
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
