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
import { MockBidderRepository } from './core/services/mock-bidder.repository';
import { MockChunkTransport } from './core/services/mock-chunk-transport';
import { MockImageRenderer } from './core/services/mock-image-renderer';
import { MockTenderRepository } from './core/services/mock-tender.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
    // Repository bindings — swap to HttpTenderRepository / HttpBidderRepository
    // once the real backend is live, with no component-level edits.
    { provide: TENDER_REPOSITORY, useExisting: MockTenderRepository },
    { provide: BIDDER_REPOSITORY, useExisting: MockBidderRepository },
    // Upload transport — swap to S3MultipartTransport / TusTransport / HttpPostTransport.
    { provide: UPLOAD_TRANSPORT, useExisting: MockChunkTransport },
    // Document renderer — swap to ServerImageRenderer / PdfJsRenderer when real docs arrive.
    { provide: DOCUMENT_RENDERER, useExisting: MockImageRenderer },
  ],
};
