import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { TenderStageStore } from './tender-stage.store';

/**
 * Broadcasts the live evaluation progress (0–100) for each tender that
 * is currently in-flight. This service is the single seam between the UI
 * and "how evaluation progress is actually measured".
 *
 * Today: start() kicks off a setInterval that ticks the progress forward
 * and flips the tender's stage to 'evaluated' when it hits 100.
 *
 * Later (backend-driven): replace start()'s setInterval with either
 *   - an SSE subscription to /tenders/{id}/evaluation/progress, or
 *   - a polling loop over a GET /tenders/{id}/evaluation endpoint.
 * The rest of the app only reads progress$(id), so the swap is local.
 */
@Injectable({ providedIn: 'root' })
export class TenderEvaluationProgressService {
  private readonly stages = inject(TenderStageStore);

  /** tenderId → current progress percent (0–100). */
  private readonly progresses$ = new BehaviorSubject<Record<string, number>>({});
  /** Active mock timers per tender, so we can cancel on stop(). */
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  /** Mock tick speed. One run from 0→100 takes ~20s. */
  private readonly tickMs = 400;
  private readonly tickDelta = 2;

  constructor() {
    // Resume anything that was mid-evaluation when the page was reloaded.
    this.stages.tendersInStage('in-evaluation').forEach((id) => this.start(id));
  }

  /** Kick off (or re-start) a mock evaluation run for a tender. */
  start(tenderId: string): void {
    this.stopInternal(tenderId);
    this.setProgress(tenderId, 0);
    this.stages.set(tenderId, 'in-evaluation');

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

  /** Stream of progress (0–100) for a given tender. Emits 0 until a run
   *  starts; emits 100 once the run completes. */
  progress$(tenderId: string): Observable<number> {
    return this.progresses$.pipe(
      map((m) => m[tenderId] ?? 0),
      distinctUntilChanged(),
    );
  }

  /** Snapshot of the current value — useful for non-async template paths. */
  snapshot(tenderId: string): number {
    return this.progresses$.value[tenderId] ?? 0;
  }

  /** Called when a tender is removed or its run is cancelled externally. */
  stop(tenderId: string): void {
    this.stopInternal(tenderId);
    const { [tenderId]: _, ...rest } = this.progresses$.value;
    this.progresses$.next(rest);
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

/** Constructor convenience for tests / non-Angular seams — prefer DI in
 *  components, but this lets us expose a plain observable signature in
 *  templates if needed. */
export function fallbackProgress$(): Observable<number> {
  return of(0);
}
