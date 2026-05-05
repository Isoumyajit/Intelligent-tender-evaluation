import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Lightweight cross-component notification channel. Repositories broadcast
 * after mutations; pages that care about freshness subscribe to the matching
 * stream and re-read from their repository.
 *
 * Today this is hand-fired by the mock repositories after in-memory writes.
 * Once the real backend is wired, the same bus can be fed by:
 *   - HTTP repositories emitting on their own successful write calls, or
 *   - a single SSE/WebSocket subscription that dispatches into the bus.
 *
 * Pages are unaware of either — they just pipe their list calls through the
 * bus and get refreshed data.
 */
@Injectable({ providedIn: 'root' })
export class RefreshBus {
  private readonly tendersChanged$ = new Subject<void>();

  /** Stream that fires whenever the tender list may have changed. */
  readonly tenders$: Observable<void> = this.tendersChanged$.asObservable();

  /** Call after any tender-state-affecting write succeeds. */
  emitTendersChanged(): void {
    this.tendersChanged$.next();
  }
}
