import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ProcessedTender } from '../models/evaluation.models';

export interface TenderRepository {
  list(): Observable<ProcessedTender[]>;
  getById(id: string): Observable<ProcessedTender | undefined>;
}

export const TENDER_REPOSITORY = new InjectionToken<TenderRepository>(
  'TENDER_REPOSITORY',
);
