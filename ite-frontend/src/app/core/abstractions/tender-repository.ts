import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ProcessedTender } from '../models/evaluation.models';

/**
 * Payload the UI sends when a new tender is uploaded. Metadata only —
 * the backend mints the ID. Document-blob persistence happens over a
 * separate upload transport.
 */
export interface CreateTenderPayload {
  name: string;
  documentName: string;
  documentSize?: string;
  authority?: string;
  description?: string;
}

export interface TenderRepository {
  list(): Observable<ProcessedTender[]>;
  getById(id: string): Observable<ProcessedTender | undefined>;
  create(payload: CreateTenderPayload): Observable<ProcessedTender>;
}

export const TENDER_REPOSITORY = new InjectionToken<TenderRepository>(
  'TENDER_REPOSITORY',
);
