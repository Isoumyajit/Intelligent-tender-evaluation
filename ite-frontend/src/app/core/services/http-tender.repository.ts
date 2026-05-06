import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CreateTenderPayload,
  TenderRepository,
} from '../abstractions/tender-repository';
import { ProcessedTender } from '../models/evaluation.models';
import { RefreshBus } from './refresh-bus';

/**
 * HTTP-backed TenderRepository. The backend emits camelCase JSON matching
 * ProcessedTender, so the response is consumed as-is. Writes fire the
 * RefreshBus so every consumer (dashboard, evaluations page, header badge)
 * re-reads automatically.
 */
@Injectable({ providedIn: 'root' })
export class HttpTenderRepository implements TenderRepository {
  private readonly http = inject(HttpClient);
  private readonly refresh = inject(RefreshBus);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<ProcessedTender[]> {
    return this.http.get<ProcessedTender[]>(`${this.base}/tenders`);
  }

  getById(id: string): Observable<ProcessedTender | undefined> {
    return this.http.get<ProcessedTender>(
      `${this.base}/tenders/${encodeURIComponent(id)}`,
    );
  }

  create(payload: CreateTenderPayload): Observable<ProcessedTender> {
    return this.http
      .post<ProcessedTender>(`${this.base}/tenders`, payload)
      .pipe(tap(() => this.refresh.emitTendersChanged()));
  }
}
