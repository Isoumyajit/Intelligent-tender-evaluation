import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type FitMode = 'none' | 'width' | 'page';
export type Rotation = 0 | 90 | 180 | 270;

export interface ViewerState {
  documentId: string | null;
  totalPages: number;
  currentPage: number; // 1-based
  zoom: number; // 1 = 100 %
  rotation: Rotation;
  fitMode: FitMode;
  fullscreen: boolean;
}

const INITIAL: ViewerState = {
  documentId: null,
  totalPages: 0,
  currentPage: 1,
  zoom: 1,
  rotation: 0,
  fitMode: 'width',
  fullscreen: false,
};

/**
 * Single source of truth for the viewer UI. Every control (toolbar buttons,
 * keyboard shortcuts, future thumbnail strip) mutates through these helpers,
 * never by reaching into component properties — which keeps the viewer and
 * toolbar decoupled.
 */
@Injectable()
export class ViewerStateService {
  readonly MIN_ZOOM = 0.25;
  readonly MAX_ZOOM = 5;
  readonly ZOOM_STEP = 0.25;

  private readonly state$ = new BehaviorSubject<ViewerState>({ ...INITIAL });

  readonly changes$: Observable<ViewerState> = this.state$.asObservable();

  get snapshot(): ViewerState {
    return this.state$.value;
  }

  init(documentId: string, totalPages: number): void {
    this.patch({ ...INITIAL, documentId, totalPages, currentPage: 1 });
  }

  reset(): void {
    this.patch({ ...INITIAL });
  }

  setPage(page: number): void {
    const { totalPages } = this.snapshot;
    if (totalPages === 0) return;
    const clamped = Math.min(Math.max(1, page), totalPages);
    if (clamped === this.snapshot.currentPage) return;
    this.patch({ currentPage: clamped });
  }

  nextPage(): void {
    this.setPage(this.snapshot.currentPage + 1);
  }

  prevPage(): void {
    this.setPage(this.snapshot.currentPage - 1);
  }

  setZoom(zoom: number): void {
    const clamped = this.clampZoom(zoom);
    this.patch({ zoom: clamped, fitMode: 'none' });
  }

  zoomIn(): void {
    this.setZoom(this.snapshot.zoom + this.ZOOM_STEP);
  }

  zoomOut(): void {
    this.setZoom(this.snapshot.zoom - this.ZOOM_STEP);
  }

  resetZoom(): void {
    this.setZoom(1);
  }

  setFit(mode: FitMode): void {
    this.patch({ fitMode: mode });
  }

  rotateBy(delta: 90 | -90): void {
    const next = (((this.snapshot.rotation + delta) % 360) + 360) % 360;
    this.patch({ rotation: next as Rotation });
  }

  toggleFullscreen(): void {
    this.patch({ fullscreen: !this.snapshot.fullscreen });
  }

  private clampZoom(value: number): number {
    if (Number.isNaN(value)) return this.snapshot.zoom;
    return Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, value));
  }

  private patch(partial: Partial<ViewerState>): void {
    this.state$.next({ ...this.snapshot, ...partial });
  }
}
