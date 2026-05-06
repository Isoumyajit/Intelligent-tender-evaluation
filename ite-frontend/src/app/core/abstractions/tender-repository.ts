import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ProcessedTender } from '../models/evaluation.models';

export interface CreateTenderExtras {
  authority?: string;
  reference?: string;
  description?: string;
}

export interface TenderRepository {
  list(): Observable<ProcessedTender[]>;
  getById(id: string): Observable<ProcessedTender | undefined>;
  createWithDocument(
    tenderName: string,
    document: File,
    extras?: CreateTenderExtras,
  ): Observable<ProcessedTender>;
}

export const TENDER_REPOSITORY = new InjectionToken<TenderRepository>(
  'TENDER_REPOSITORY',
);
