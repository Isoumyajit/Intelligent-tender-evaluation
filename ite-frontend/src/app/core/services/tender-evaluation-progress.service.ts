import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of, timer } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  map,
  switchMap,
  takeWhile,
  tap,
} from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { BIDDER_REPOSITORY } from '../abstractions/bidder-repository';
import { TenderStageStore } from './tender-stage.store';

interface ProcessTenderRequest {
  tender_id: string;
  bidder_ids: string[];
}

interface ProcessTenderStartResponse {
  job_id: string;
}

interface JobStatusResponse {
  job_id: string;
  tender_id: string;
  tender_name: string;
  status: string;
  criteria: unknown[];
  bidders: unknown[];
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class TenderEvaluationProgressService {
  private readonly stages = inject(TenderStageStore);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private readonly progresses$ = new BehaviorSubject<Record<string, number>>(
    {},
  );

  private readonly _errors$ = new Subject<{
    tenderId: string;
    message: string;
  }>();
  readonly errors$ = this._errors$.asObservable();

  constructor() {
    this.stages.tendersInStage('in-evaluation').forEach((id) => {
      this.setProgress(id, 0);
      this.stages.set(id, 'fresh');
    });
  }

  start(tenderId: string): void {
    this.setProgress(tenderId, 0);
    this.stages.set(tenderId, 'in-evaluation');

    this.bidderRepo
      .listForTender(tenderId)
      .pipe(
        map((bidders) => bidders.map((b) => b.id)),
        tap((bidderIds) => {
          if (bidderIds.length === 0) {
            this.stages.set(tenderId, 'fresh');
            return;
          }
          this.postAndPoll(tenderId, bidderIds);
        }),
        catchError(() => {
          this.stages.set(tenderId, 'fresh');
          this.setProgress(tenderId, 0);
          this._errors$.next({
            tenderId,
            message: 'Could not start evaluation. Please try again.',
          });
          return of(null);
        }),
      )
      .subscribe();
  }

  progress$(tenderId: string): Observable<number> {
    return this.progresses$.pipe(
      map((m) => m[tenderId] ?? 0),
      distinctUntilChanged(),
    );
  }

  snapshot(tenderId: string): number {
    return this.progresses$.value[tenderId] ?? 0;
  }

  stop(tenderId: string): void {
    const { [tenderId]: _, ...rest } = this.progresses$.value;
    this.progresses$.next(rest);
  }

  private postAndPoll(tenderId: string, bidderIds: string[]): void {
    const body: ProcessTenderRequest = {
      tender_id: tenderId,
      bidder_ids: bidderIds,
    };

    this.setProgress(tenderId, 10);

    this.http
      .post<ProcessTenderStartResponse>(
        `${this.base}/process-tender/`,
        body,
      )
      .pipe(
        catchError(() => {
          this.stages.set(tenderId, 'fresh');
          this.setProgress(tenderId, 0);
          this._errors$.next({
            tenderId,
            message: 'Failed to start evaluation. Please try again.',
          });
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (!res) return;
        this.setProgress(tenderId, 20);
        this.pollJobStatus(tenderId, res.job_id);
      });
  }

  private pollJobStatus(tenderId: string, jobId: string): void {
    const pollInterval = 3000;
    let tick = 0;

    timer(0, pollInterval)
      .pipe(
        switchMap(() =>
          this.http
            .get<JobStatusResponse>(
              `${this.base}/process-tender/${encodeURIComponent(jobId)}`,
            )
            .pipe(catchError(() => of(null))),
        ),
        tap(() => {
          tick++;
          const progress = Math.min(90, 20 + tick * 10);
          this.setProgress(tenderId, progress);
        }),
        takeWhile((res) => {
          if (!res) return true;
          if (res.status === 'completed') {
            this.setProgress(tenderId, 100);
            this.stages.set(tenderId, 'evaluated');
            return false;
          }
          if (res.status === 'failed') {
            this.setProgress(tenderId, 0);
            this.stages.set(tenderId, 'fresh');
            this._errors$.next({
              tenderId,
              message:
                'Evaluation failed. Please check the tender and try again.',
            });
            return false;
          }
          return true;
        }),
      )
      .subscribe();
  }

  private setProgress(tenderId: string, value: number): void {
    this.progresses$.next({ ...this.progresses$.value, [tenderId]: value });
  }
}

export function fallbackProgress$(): Observable<number> {
  return of(0);
}
