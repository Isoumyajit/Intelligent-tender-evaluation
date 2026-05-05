import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  DocumentMetadata,
  DocumentRenderer,
  RenderedPage,
} from '../abstractions/document-renderer';

/**
 * Mock renderer used until the backend is wired. Returns a synthesised SVG
 * page wrapped in a Blob, mimicking exactly what a future ServerImageRenderer
 * will produce (one Blob per page fetched over HTTP). Swapping to the real
 * implementation is a single binding change in app.config.ts — no viewer edits.
 */
@Injectable({ providedIn: 'root' })
export class MockImageRenderer implements DocumentRenderer {
  readonly kind = 'mock';

  private readonly defaultPages = 5;
  private readonly pageWidth = 900;
  private readonly pageHeight = 1165; // A4-ish at ~110 dpi

  getMetadata(documentId: string): Observable<DocumentMetadata> {
    return of<DocumentMetadata>({
      documentId,
      fileName: documentId,
      totalPages: this.defaultPages,
      mimeType: 'image/svg+xml',
    }).pipe(delay(80));
  }

  renderPage(documentId: string, pageNumber: number): Observable<RenderedPage> {
    const svg = this.buildPageSvg(documentId, pageNumber);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    return of<RenderedPage>({
      pageNumber,
      blob,
      naturalWidth: this.pageWidth,
      naturalHeight: this.pageHeight,
    }).pipe(delay(120));
  }

  private buildPageSvg(documentId: string, pageNumber: number): string {
    const w = this.pageWidth;
    const h = this.pageHeight;
    const title = `Page ${pageNumber}`;

    const lines = [
      `3.${pageNumber}  Financial Transactions`,
      '',
      'Total revenue for FY24: ₹ 65.67 Cr; 3-year average ₹ 55.00 Cr.',
      'Audited by the authorised chartered-accountant firm and signed on',
      '2026-03-31. All figures reconcile with the accompanying ledger',
      'statements reproduced in Annexure A.',
      '',
      'All references to "the Authority" mean the tendering body identified',
      'in the contract notice. Supporting certificates referenced in this',
      'section shall be construed as forming part of the evaluation',
      'evidence for the subject criterion.',
      '',
      `(continued — page ${pageNumber} of ${this.defaultPages})`,
    ];

    const lineEls = lines
      .map(
        (line, i) =>
          `<text x="90" y="${260 + i * 34}" font-family="Georgia, serif" font-size="22" fill="#1f1f1f">${this.escape(
            line,
          )}</text>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  <rect x="0" y="0" width="${w}" height="70" fill="#f3f3f3"/>
  <text x="40" y="45" font-family="Roboto, sans-serif" font-size="14" fill="#6b6b6b" letter-spacing="1.5">
    ${this.escape(documentId.toUpperCase())}
  </text>
  <text x="${w - 40}" y="45" text-anchor="end" font-family="Roboto, sans-serif" font-size="14" fill="#6b6b6b" letter-spacing="1.5">
    ${this.escape(title)}
  </text>
  <text x="90" y="180" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#111111">
    ${this.escape(title)}
  </text>
  ${lineEls}
  <rect x="0" y="${h - 50}" width="${w}" height="50" fill="#f3f3f3"/>
  <text x="${w / 2}" y="${h - 20}" text-anchor="middle" font-family="Roboto, sans-serif" font-size="12" fill="#6b6b6b">
    Page ${pageNumber} of ${this.defaultPages}
  </text>
</svg>`;
  }

  private escape(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
