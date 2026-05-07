import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
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
  private readonly pw = 900;
  private readonly ph = 1165;

  getMetadata(documentId: string): Observable<DocumentMetadata> {
    const fileName = documentId.split('/').pop() ?? documentId;
    return of<DocumentMetadata>({ documentId, fileName, totalPages: 1 });
  }

  renderPage(documentId: string, pageNumber: number): Observable<RenderedPage> {
    const url = `${this.base}${documentId}/text`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      switchMap((blob) => {
        if (blob.type.startsWith('image/')) {
          return of<RenderedPage>({
            pageNumber,
            blob,
            naturalWidth: 0,
            naturalHeight: 0,
          });
        }
        return from(blob.text()).pipe(
          map((text) => this.textToPage(text, pageNumber, documentId)),
        );
      }),
      catchError(() => of(this.svgPage(pageNumber, 'Document preview not available'))),
    );
  }

  private textToPage(content: string, page: number, docId: string): RenderedPage {
    const svg = this.renderTextAsSvg(content, page, docId);
    return {
      pageNumber: page,
      blob: new Blob([svg], { type: 'image/svg+xml' }),
      naturalWidth: this.pw,
      naturalHeight: this.ph,
    };
  }

  private renderTextAsSvg(content: string, page: number, docId: string): string {
    const w = this.pw;
    const h = this.ph;
    const rawLines = content.split('\n');
    const lines = rawLines.slice(0, 38);
    const fileName = docId.split('/').pop() ?? 'Document';

    const lineEls = lines
      .map((l, i) => {
        const text = this.esc(l.substring(0, 110));
        const trimmed = l.trim();
        const isBold =
          /^\d+\./.test(trimmed) ||
          trimmed.startsWith('BIDDER') ||
          trimmed.startsWith('GOVERNMENT') ||
          trimmed.startsWith('Registration') ||
          trimmed.startsWith('Bank') ||
          trimmed.startsWith('GST') ||
          trimmed.startsWith('EMD') ||
          trimmed.startsWith('Tender') ||
          trimmed.startsWith('Affidavit') ||
          trimmed.startsWith('NOTE');
        const size = isBold ? 11 : 10;
        const fill = isBold ? '#1a237e' : '#333';
        const weight = isBold ? ' font-weight="600"' : '';
        return `<text x="45" y="${88 + i * 24}" font-family="'Segoe UI', sans-serif" font-size="${size}" fill="${fill}"${weight}>${text}</text>`;
      })
      .join('\n    ');

    const moreLabel =
      rawLines.length > 38
        ? `<text x="45" y="${88 + 38 * 24 + 8}" font-family="sans-serif" font-size="10" fill="#999">… ${rawLines.length - 38} more lines</text>`
        : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#fefefe"/>
  <rect width="${w}" height="54" fill="#f5f5f5"/>
  <text x="20" y="22" font-family="sans-serif" font-size="9" fill="#888" letter-spacing="0.5">DOCUMENT PREVIEW</text>
  <text x="20" y="40" font-family="sans-serif" font-size="11" font-weight="600" fill="#333">${this.esc(fileName)}</text>
  <text x="${w - 20}" y="40" text-anchor="end" font-family="sans-serif" font-size="10" fill="#888">Page ${page}</text>
  <line x1="0" y1="54" x2="${w}" y2="54" stroke="#e0e0e0" stroke-width="1"/>
    ${lineEls}
    ${moreLabel}
</svg>`;
  }

  private svgPage(pageNumber: number, message: string): RenderedPage {
    const w = this.pw;
    const h = this.ph;
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
