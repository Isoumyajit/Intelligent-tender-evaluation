import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { BIDDER_REPOSITORY } from '../abstractions/bidder-repository';
import { TenderStageStore } from './tender-stage.store';

interface ProcessTenderRequest {
  tender_id: string;
  bidder_ids: string[];
}

interface ProcessTenderResponse {
  tender_id: string;
  tender_name: string;
  criteria: unknown[];
  bidder_ids: string[];
}

/**
 * Broadcasts the live evaluation progress (0–100) for each tender that
 * is currently in-flight. This service is the single seam between the UI
 * and "how evaluation progress is actually measured".
 *
 * start(id) calls the real backend POST /process-tender/ to kick off
 * evaluation. The backend's response is synchronous today (criteria
 * extraction only), so we animate a local progress bar from 0→100 as a
 * stand-in until the backend exposes a streaming progress endpoint.
 * When that happens, replace the setInterval inside start() with an SSE
 * subscription or a polling loop — the progress$() contract doesn't
 * change, so pages are unaffected.
 */
@Injectable({ providedIn: 'root' })
export class TenderEvaluationProgressService {
  private readonly stages = inject(TenderStageStore);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private readonly progresses$ = new BehaviorSubject<Record<string, number>>({});
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly tickMs = 400;
  private readonly tickDelta = 2;

  constructor() {
    // Resume anything that was mid-evaluation when the page was reloaded.
    // Best-effort: without a backend progress endpoint we just re-run the
    // visual counter. Real backend progress would subscribe here instead.
    this.stages.tendersInStage('in-evaluation').forEach((id) => {
      this.setProgress(id, 0);
      this.startLocalTicker(id);
    });
  }

  /** Fetch bidders for the tender, fire POST /process-tender/, then drive
   *  the visual progress bar until 100 and flip stage to 'evaluated'. */
  start(tenderId: string): void {
    this.stopInternal(tenderId);
    this.setProgress(tenderId, 0);
    this.stages.set(tenderId, 'in-evaluation');

    this.bidderRepo
      .listForTender(tenderId)
      .pipe(
        map((bidders) => bidders.map((b) => b.id)),
        tap((bidderIds) => {
          if (bidderIds.length === 0) {
            // Guard is mirrored in callers, but keep defensive here.
            this.stages.set(tenderId, 'fresh');
            this.stopInternal(tenderId);
            return;
          }
          this.postProcess(tenderId, bidderIds);
        }),
        catchError((err) => {
          this.stages.set(tenderId, 'fresh');
          this.stopInternal(tenderId);
          throw err;
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
    this.stopInternal(tenderId);
    const { [tenderId]: _, ...rest } = this.progresses$.value;
    this.progresses$.next(rest);
  }

  private postProcess(tenderId: string, bidderIds: string[]): void {
    const body: ProcessTenderRequest = {
      tender_id: tenderId,
      bidder_ids: bidderIds,
    };
    this.startLocalTicker(tenderId);
    this.http
      .post<ProcessTenderResponse>(`${this.base}/process-tender/`, body)
      .pipe(
        catchError((err) => {
          this.stopInternal(tenderId);
          this.stages.set(tenderId, 'fresh');
          this.setProgress(tenderId, 0);
          throw err;
        }),
      )
      .subscribe(() => {
        // Backend returned — let the visual ticker finish to 100 if it
        // hasn't already, then flip to evaluated. The ticker itself
        // handles the flip when it hits 100, so nothing extra here.
      });
  }

  private startLocalTicker(tenderId: string): void {
    const timer = setInterval(() => {
      const current = this.progresses$.value[tenderId] ?? 0;
      const next = Math.min(100, current + this.tickDelta);
      this.setProgress(tenderId, next);
      if (next >= 100) {
        this.stopInternal(tenderId);
        this.stages.set(tenderId, 'evaluated');
      }
    }, this.tickMs);
    this.timers.set(tenderId, timer);
  }

  private stopInternal(tenderId: string): void {
    const t = this.timers.get(tenderId);
    if (t) {
      clearInterval(t);
      this.timers.delete(tenderId);
    }
  }

  private setProgress(tenderId: string, value: number): void {
    this.progresses$.next({ ...this.progresses$.value, [tenderId]: value });
  }
}

export function fallbackProgress$(): Observable<number> {
  return of(0);
}
