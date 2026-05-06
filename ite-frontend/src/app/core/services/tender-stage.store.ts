import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type TenderStage =
  | 'fresh'
  | 'in-evaluation'
  | 'evaluated'
  | 'closed';

const STORAGE_KEY = 'ite.tender-stage.v1';

/**
 * Per-tender evaluation stage — stored client-side because the backend
 * has no status column yet. The value decorates each ProcessedTender at
 * the HTTP-repo boundary so every page (dashboard, evaluations, tender
 * list) reads the same source of truth.
 *
 * When the backend gains a real status column, this service can be
 * deleted and the repo can read the backend value directly.
 *
 * NOTE: stage changes are local — they do NOT trigger a tender/bid
 * refetch. Subscribe to `changes$` if you need to react to a stage flip
 * without hitting the backend again.
 */
@Injectable({ providedIn: 'root' })
export class TenderStageStore {
  private cache = this.load();
  private readonly changes = new Subject<{ tenderId: string; stage: TenderStage }>();

  readonly changes$: Observable<{ tenderId: string; stage: TenderStage }> =
    this.changes.asObservable();

  get(tenderId: string): TenderStage {
    return this.cache[tenderId] ?? 'fresh';
  }

  set(tenderId: string, stage: TenderStage): void {
    if (this.cache[tenderId] === stage) return;
    this.cache = { ...this.cache, [tenderId]: stage };
    this.persist();
    this.changes.next({ tenderId, stage });
  }

  /** Tender IDs currently in the given stage. Useful at boot to resume
   *  any in-flight evaluations that started before a page reload. */
  tendersInStage(stage: TenderStage): string[] {
    return Object.entries(this.cache)
      .filter(([, s]) => s === stage)
      .map(([id]) => id);
  }

  private load(): Record<string, TenderStage> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, TenderStage>) : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // Swallow storage errors (quota exceeded, private mode). The in-memory
      // cache still serves this session.
    }
  }
}
