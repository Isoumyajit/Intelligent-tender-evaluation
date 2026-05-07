import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  DocumentMetadata,
  DocumentRenderer,
  RenderedPage,
} from '../abstractions/document-renderer';

@Injectable({ providedIn: 'root' })
export class ServerDocumentRenderer implements DocumentRenderer {
  readonly kind = 'server-image';

  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getMetadata(documentId: string): Observable<DocumentMetadata> {
    const fileName = documentId.split('/').pop() ?? documentId;
    const metaUrl = `${this.base}${documentId}/metadata`;

    return this.http
      .get<{ documentId: string; fileName: string; totalPages: number; mimeType: string }>(metaUrl)
      .pipe(
        map((res) => ({
          documentId,
          fileName: res.fileName ?? fileName,
          totalPages: res.totalPages ?? 1,
          mimeType: res.mimeType,
        })),
        catchError(() =>
          of<DocumentMetadata>({ documentId, fileName, totalPages: 1 }),
        ),
      );
  }

  renderPage(documentId: string, pageNumber: number): Observable<RenderedPage> {
    const pageUrl = `${this.base}${documentId}/page/${pageNumber}`;

    return this.http.get(pageUrl, { responseType: 'blob' }).pipe(
      map((blob) => ({
        pageNumber,
        blob,
        naturalWidth: 0,
        naturalHeight: 0,
      })),
      catchError(() => {
        const textUrl = `${this.base}${documentId}/text`;
        return this.http.get(textUrl, { responseType: 'blob' }).pipe(
          map((blob) => {
            if (blob.type.startsWith('image/')) {
              return { pageNumber, blob, naturalWidth: 0, naturalHeight: 0 } as RenderedPage;
            }
            return this.fallbackPage(pageNumber, 'Document preview not available');
          }),
          catchError(() => of(this.fallbackPage(pageNumber, 'Document preview not available'))),
        );
      }),
    );
  }

  private fallbackPage(pageNumber: number, message: string): RenderedPage {
    const w = 900;
    const h = 1165;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#fff"/>
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#999">${this.esc(message)}</text>
</svg>`;
    return {
      pageNumber,
      blob: new Blob([svg], { type: 'image/svg+xml' }),
      naturalWidth: w,
      naturalHeight: h,
    };
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
