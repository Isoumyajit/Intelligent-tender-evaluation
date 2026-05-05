import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface UploadProgress {
  bytesUploaded: number;
  progressPercent: number;
  chunkIndex: number;
  chunkCount: number;
}

export type UploadOutcome =
  | { kind: 'progress'; progress: UploadProgress }
  | { kind: 'processing' }
  | { kind: 'completed' }
  | { kind: 'failed'; error: string };

export interface UploadItemDescriptor {
  id: string;
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  retries: number;
}

/**
 * An UploadTransport performs the actual byte transfer for a single file.
 * Implementations: MockChunkTransport (demo), future S3MultipartTransport,
 * TusTransport, HttpPostTransport.
 */
export interface UploadTransport {
  /**
   * Emit progress events, terminating with completed or failed.
   * Unsubscribe must cancel in-flight work.
   */
  upload(item: UploadItemDescriptor): Observable<UploadOutcome>;
}

export const UPLOAD_TRANSPORT = new InjectionToken<UploadTransport>(
  'UPLOAD_TRANSPORT',
);
