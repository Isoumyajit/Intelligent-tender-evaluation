import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  CreateTenderExtras,
  TenderRepository,
} from '../abstractions/tender-repository';
import {
  ProcessedTender,
  TenderStatus,
} from '../models/evaluation.models';
import { RefreshBus } from './refresh-bus';
import { TenderStage, TenderStageStore } from './tender-stage.store';

/**
 * Shape returned by GET /tenders/. The backend keeps tenders minimal —
 * id, name, timestamps — so everything else the UI needs is synthesized
 * with defaults at the adapter boundary.
 */
interface TenderListRow {
  tender_id: string;
  tender_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Shape returned by GET /tenders/{id} and POST /tenders/. Includes the
 * attachment relation for the uploaded document.
 */
interface TenderDetail extends TenderListRow {
  tender_ref: string | null;
  attachment: {
    attachment_ref_id: string;
    file_name: string;
    content_type: string;
    created_at: string;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class HttpTenderRepository implements TenderRepository {
  private readonly http = inject(HttpClient);
  private readonly refresh = inject(RefreshBus);
  private readonly stages = inject(TenderStageStore);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<ProcessedTender[]> {
    return this.http
      .get<TenderListRow[]>(`${this.base}/tenders/`)
      .pipe(map((rows) => rows.map((r) => this.adaptList(r))));
  }

  getById(id: string): Observable<ProcessedTender | undefined> {
    return this.http
      .get<TenderDetail>(`${this.base}/tenders/${encodeURIComponent(id)}`)
      .pipe(map((t) => this.adaptDetail(t)));
  }

  createWithDocument(
    tenderName: string,
    document: File,
    _extras?: CreateTenderExtras,
  ): Observable<ProcessedTender> {
    const body = new FormData();
    body.append('tender_name', tenderName);
    body.append('document', document, document.name);

    return this.http
      .post<TenderDetail>(`${this.base}/tenders/`, body)
      .pipe(
        map((raw) => this.adaptDetail(raw)),
        tap(() => this.refresh.emitTendersChanged()),
      );
  }

  private adaptList(raw: TenderListRow): ProcessedTender {
    return {
      id: raw.tender_id,
      reference: raw.tender_id,
      name: raw.tender_name,
      authority: '—',
      uploadedDate: raw.created_at.split('T')[0] ?? '',
      closingDate: '',
      status: this.statusFromStage(this.stages.get(raw.tender_id)),
      biddersCount: 0,
      documentName: '',
      documentSize: '',
      estimatedValue: '',
      description: '',
    };
  }

  private adaptDetail(raw: TenderDetail): ProcessedTender {
    return {
      id: raw.tender_id,
      reference: raw.tender_id,
      name: raw.tender_name,
      authority: '—',
      uploadedDate: raw.created_at.split('T')[0] ?? '',
      closingDate: '',
      status: this.statusFromStage(this.stages.get(raw.tender_id)),
      biddersCount: 0,
      documentName: raw.attachment?.file_name ?? '',
      documentSize: '',
      estimatedValue: '',
      description: '',
    };
  }

  private statusFromStage(stage: TenderStage): TenderStatus {
    switch (stage) {
      case 'in-evaluation':
        return 'Technical Evaluation';
      case 'evaluated':
        return 'Financial Comparison';
      case 'closed':
        return 'Closed';
      case 'fresh':
      default:
        return 'Pending Review';
    }
  }
}
