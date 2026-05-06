import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import { routes } from './app.routes';
import { BIDDER_REPOSITORY } from './core/abstractions/bidder-repository';
import { DOCUMENT_RENDERER } from './core/abstractions/document-renderer';
import { TENDER_REPOSITORY } from './core/abstractions/tender-repository';
import { UPLOAD_TRANSPORT } from './core/abstractions/upload-transport';
import { apiErrorInterceptor } from './core/http/api-error.interceptor';
import { HttpBidderRepository } from './core/services/http-bidder.repository';
import { HttpTenderRepository } from './core/services/http-tender.repository';
import { MockChunkTransport } from './core/services/mock-chunk-transport';
import { MockImageRenderer } from './core/services/mock-image-renderer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
    // Tender + bidder data come from the snake_case backend at
    // environment.apiBaseUrl (CORS-enabled for the Angular dev server).
    { provide: TENDER_REPOSITORY, useExisting: HttpTenderRepository },
    { provide: BIDDER_REPOSITORY, useExisting: HttpBidderRepository },
    // Upload transport — swap to S3MultipartTransport / TusTransport / HttpPostTransport
    // when a real resumable upload endpoint exists.
    { provide: UPLOAD_TRANSPORT, useExisting: MockChunkTransport },
    // Document renderer — still mock until the backend exposes page-image
    // endpoints. The DocumentViewer doesn't care which implementation it
    // gets, so swapping is one line.
    { provide: DOCUMENT_RENDERER, useExisting: MockImageRenderer },
  ],
};
