import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TenderRepository } from '../abstractions/tender-repository';
import { ProcessedTender } from '../models/evaluation.models';

/**
 * HTTP-backed TenderRepository. The backend already emits camelCase JSON
 * that matches ProcessedTender, so the response is consumed as-is.
 */
@Injectable({ providedIn: 'root' })
export class HttpTenderRepository implements TenderRepository {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<ProcessedTender[]> {
    return this.http.get<ProcessedTender[]>(`${this.base}/tenders`);
  }

  getById(id: string): Observable<ProcessedTender | undefined> {
    return this.http
      .get<ProcessedTender>(`${this.base}/tenders/${encodeURIComponent(id)}`)
      .pipe(
        map((t) => t),
      );
  }
}
