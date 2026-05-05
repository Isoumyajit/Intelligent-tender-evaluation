import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * One rendered page of a document.
 *
 * Today the backend returns rasterised images (one Blob per page). The field
 * is typed as `Blob` so the renderer can also return e.g. `new Blob([bytes],
 * { type: 'image/png' })` constructed client-side without any spec changes.
 *
 * When a renderer fetches remote bytes, it is responsible for creating the
 * Blob. The viewer takes it from there — creates an object URL, renders into
 * an <img>, revokes the URL on teardown.
 */
export interface RenderedPage {
  /** 1-based page number this payload corresponds to. */
  pageNumber: number;
  /** The rasterised page image bytes. Any browser-decodable MIME works. */
  blob: Blob;
  /** Intrinsic page width in pixels (pre-rotation, pre-zoom). Optional —
   *  the viewer falls back to the natural dimensions after image load. */
  naturalWidth?: number;
  /** Intrinsic page height in pixels (pre-rotation, pre-zoom). */
  naturalHeight?: number;
}

export interface DocumentMetadata {
  documentId: string;
  fileName: string;
  totalPages: number;
  mimeType?: string;
}

/**
 * The single seam that makes viewer backends swappable. Any concrete renderer
 * (mock, server-image, future on-device PDF.js) implements this.
 *
 * Invariants every implementation must honour:
 *   1. pageNumber is 1-based everywhere.
 *   2. renderPage may be called repeatedly for the same page — implementations
 *      are free to memoise, but the viewer also memoises defensively.
 *   3. The returned Blob must be something the browser can decode in an <img>
 *      element (PNG / JPEG / WebP / etc.).
 */
export interface DocumentRenderer {
  readonly kind: 'mock' | 'server-image' | string;

  getMetadata(documentId: string): Observable<DocumentMetadata>;

  renderPage(documentId: string, pageNumber: number): Observable<RenderedPage>;
}

export const DOCUMENT_RENDERER = new InjectionToken<DocumentRenderer>(
  'DOCUMENT_RENDERER',
);
