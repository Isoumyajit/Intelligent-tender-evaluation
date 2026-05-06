import { Injectable, inject } from '@angular/core';
import { RefreshBus } from './refresh-bus';

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
 */
@Injectable({ providedIn: 'root' })
export class TenderStageStore {
  private readonly refresh = inject(RefreshBus);
  private cache = this.load();

  get(tenderId: string): TenderStage {
    return this.cache[tenderId] ?? 'fresh';
  }

  set(tenderId: string, stage: TenderStage): void {
    this.cache = { ...this.cache, [tenderId]: stage };
    this.persist();
    this.refresh.emitTendersChanged();
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
