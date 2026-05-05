import { Injectable } from '@angular/core';
import { Observable, Subscription, timer } from 'rxjs';
import {
  UploadItemDescriptor,
  UploadOutcome,
  UploadTransport,
} from '../abstractions/upload-transport';

/**
 * Mock transport that simulates chunked uploads with deterministic-ish
 * timing. Emits progress events, transitions through a processing
 * phase, and reports completion/failure.
 *
 * Fails deterministically on file names containing "suspicious" /
 * "corrupt" / ending in ".exe" when retries === 0 — this exercises the
 * retry UX without real malware.
 *
 * Replace with S3MultipartTransport, TusTransport, or HttpPostTransport
 * by providing a different implementation of UploadTransport.
 */
@Injectable({ providedIn: 'root' })
export class MockChunkTransport implements UploadTransport {
  readonly chunkSizeBytes = 4 * 1024 * 1024;

  upload(item: UploadItemDescriptor): Observable<UploadOutcome> {
    return new Observable<UploadOutcome>((sub) => {
      const chunkCount = Math.max(1, Math.ceil(item.sizeBytes / this.chunkSizeBytes));
      let chunkIndex = 0;
      let bytesUploaded = 0;
      const subs: Subscription[] = [];

      const simulateChunk = () => {
        if (chunkIndex >= chunkCount) {
          sub.next({ kind: 'processing' });
          subs.push(
            timer(250).subscribe(() => {
              const shouldFail =
                item.retries === 0 &&
                /\.exe$|suspicious|corrupt/i.test(item.fileName);
              if (shouldFail) {
                sub.next({
                  kind: 'failed',
                  error: 'Virus scan flagged suspicious content.',
                });
              } else {
                sub.next({ kind: 'completed' });
              }
              sub.complete();
            }),
          );
          return;
        }

        const chunkTime = 80 + Math.random() * 180;
        subs.push(
          timer(chunkTime).subscribe(() => {
            const chunkBytes = Math.min(
              this.chunkSizeBytes,
              item.sizeBytes - bytesUploaded,
            );
            bytesUploaded += chunkBytes;
            chunkIndex += 1;

            sub.next({
              kind: 'progress',
              progress: {
                bytesUploaded,
                chunkIndex,
                chunkCount,
                progressPercent: Math.round(
                  (bytesUploaded / Math.max(item.sizeBytes, 1)) * 100,
                ),
              },
            });
            simulateChunk();
          }),
        );
      };

      // Initial validating delay, kept to mimic backend handshake.
      subs.push(timer(120).subscribe(() => simulateChunk()));

      return () => {
        subs.forEach((s) => s.unsubscribe());
      };
    });
  }
}
