import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import {
  UPLOAD_TRANSPORT,
  UploadTransport,
} from '../abstractions/upload-transport';

export type UploadPhase =
  | 'queued'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface UploadItem {
  id: string;
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  bytesUploaded: number;
  progress: number;
  phase: UploadPhase;
  errorMessage?: string;
  chunkCount: number;
  chunksUploaded: number;
  retries: number;
}

export interface BidderGroup {
  id: string;
  groupName: string;
  items: UploadItem[];
  totalSize: number;
  uploadedSize: number;
  progress: number;
  phase: UploadPhase;
  detectedFromZip: boolean;
}

export interface UploadSessionState {
  sessionId: string;
  mode: 'folder' | 'zip';
  groups: BidderGroup[];
  overallProgress: number;
  totalSize: number;
  uploadedSize: number;
  activeUploads: number;
  phase: UploadPhase;
  startedAt?: number;
  finishedAt?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UploadLimits {
  maxFileSizeBytes: number;
  maxTotalSizeBytes: number;
  maxFiles: number;
  allowedExtensions: string[];
  blockedExtensions: string[];
  chunkSizeBytes: number;
  maxConcurrentUploads: number;
  maxRetries: number;
}

const DEFAULT_LIMITS: UploadLimits = {
  maxFileSizeBytes: 500 * 1024 * 1024,
  maxTotalSizeBytes: 5 * 1024 * 1024 * 1024,
  maxFiles: 2000,
  allowedExtensions: [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.png',
    '.jpg',
    '.jpeg',
    '.tif',
    '.tiff',
    '.txt',
    '.csv',
    '.zip',
  ],
  blockedExtensions: ['.exe', '.js', '.bat', '.sh', '.dll', '.msi'],
  chunkSizeBytes: 4 * 1024 * 1024,
  maxConcurrentUploads: 3,
  maxRetries: 2,
};

/**
 * UploadService owns: validation, session state, queue + concurrency,
 * retry/cancel orchestration. Actual byte transfer is delegated to the
 * UploadTransport bound to UPLOAD_TRANSPORT in app.config.
 *
 * To swap to S3 multipart / tus / direct XHR, provide a different
 * UploadTransport implementation for UPLOAD_TRANSPORT — no edits here.
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  readonly limits: UploadLimits = DEFAULT_LIMITS;

  private readonly state$ = new BehaviorSubject<UploadSessionState | null>(null);
  private readonly events$ = new Subject<UploadItem>();
  private cancelled = false;
  private activeTransfers: Subscription[] = [];
  private queue: UploadItem[] = [];
  private itemIndex = new Map<string, { group: BidderGroup; item: UploadItem }>();

  constructor(
    @Inject(UPLOAD_TRANSPORT) private readonly transport: UploadTransport,
  ) {}

  getState(): Observable<UploadSessionState | null> {
    return this.state$.asObservable();
  }

  getEvents(): Observable<UploadItem> {
    return this.events$.asObservable();
  }

  validateFiles(files: File[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalSize = 0;

    if (files.length === 0) {
      errors.push('No files selected.');
      return { valid: false, errors, warnings };
    }

    if (files.length > this.limits.maxFiles) {
      errors.push(
        `Too many files (${files.length}). Max allowed ${this.limits.maxFiles}.`,
      );
    }

    for (const file of files) {
      totalSize += file.size;
      const ext = this.extension(file.name).toLowerCase();

      if (this.limits.blockedExtensions.includes(ext)) {
        errors.push(`Blocked file type: ${file.name}`);
        continue;
      }

      if (
        this.limits.allowedExtensions.length > 0 &&
        !this.limits.allowedExtensions.includes(ext)
      ) {
        warnings.push(`Unusual file type will be skipped by pipeline: ${file.name}`);
      }

      if (file.size > this.limits.maxFileSizeBytes) {
        errors.push(
          `${file.name} is ${this.bytesToMb(file.size)} MB, exceeds limit of ${this.bytesToMb(
            this.limits.maxFileSizeBytes,
          )} MB.`,
        );
      }

      if (file.size === 0) {
        warnings.push(`${file.name} is empty.`);
      }
    }

    if (totalSize > this.limits.maxTotalSizeBytes) {
      errors.push(
        `Total upload size ${this.bytesToMb(totalSize)} MB exceeds session limit of ${this.bytesToMb(
          this.limits.maxTotalSizeBytes,
        )} MB.`,
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  prepareFolderSession(
    folderFiles: FileList | File[],
    bidderName: string,
  ): UploadSessionState {
    const files = Array.from(folderFiles);
    const items = files.map((file, idx) => this.toItem(file, idx));

    const group: BidderGroup = {
      id: `GRP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      groupName: bidderName,
      items,
      totalSize: items.reduce((s, i) => s + i.sizeBytes, 0),
      uploadedSize: 0,
      progress: 0,
      phase: 'queued',
      detectedFromZip: false,
    };

    const session: UploadSessionState = {
      sessionId: `SESSION-${Date.now()}`,
      mode: 'folder',
      groups: [group],
      totalSize: group.totalSize,
      uploadedSize: 0,
      overallProgress: 0,
      activeUploads: 0,
      phase: 'queued',
    };

    this.setSession(session);
    return session;
  }

  addBidderGroupToSession(
    folderFiles: FileList | File[],
    bidderName: string,
  ): BidderGroup | null {
    const current = this.state$.value;
    if (!current || current.mode !== 'folder') {
      return null;
    }
    if (current.phase === 'uploading' || current.phase === 'processing') {
      return null;
    }

    const files = Array.from(folderFiles);
    const items = files.map((file, idx) => this.toItem(file, idx));

    const group: BidderGroup = {
      id: `GRP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      groupName: bidderName,
      items,
      totalSize: items.reduce((s, i) => s + i.sizeBytes, 0),
      uploadedSize: 0,
      progress: 0,
      phase: 'queued',
      detectedFromZip: false,
    };

    const next: UploadSessionState = {
      ...current,
      groups: [...current.groups, group],
      totalSize: current.totalSize + group.totalSize,
    };
    this.setSession(next);
    return group;
  }

  prepareZipSession(zipFile: File): UploadSessionState {
    const zipItem = this.toItem(zipFile, 0);
    zipItem.phase = 'queued';

    const group: BidderGroup = {
      id: `GRP-ZIP-${Date.now()}`,
      groupName: zipFile.name,
      items: [zipItem],
      totalSize: zipItem.sizeBytes,
      uploadedSize: 0,
      progress: 0,
      phase: 'queued',
      detectedFromZip: true,
    };

    const session: UploadSessionState = {
      sessionId: `SESSION-${Date.now()}`,
      mode: 'zip',
      groups: [group],
      totalSize: zipItem.sizeBytes,
      uploadedSize: 0,
      overallProgress: 0,
      activeUploads: 0,
      phase: 'queued',
    };

    this.setSession(session);
    return session;
  }

  simulateZipInspection(
    zipFile: File,
  ): Observable<{ bidderFolders: string[]; fileCount: number }> {
    return new Observable((subscriber) => {
      const name = zipFile.name.replace(/\.zip$/i, '');
      const handle = setTimeout(() => {
        const guessedBidders = this.guessBiddersFromZipName(name);
        subscriber.next({
          bidderFolders: guessedBidders,
          fileCount: guessedBidders.length * 8,
        });
        subscriber.complete();
      }, 600);
      return () => clearTimeout(handle);
    });
  }

  start(): void {
    const session = this.state$.value;
    if (!session) {
      return;
    }
    this.cancelled = false;

    this.queue = session.groups.flatMap((g) => g.items);
    session.groups.forEach((g) => {
      g.items.forEach((i) => this.itemIndex.set(i.id, { group: g, item: i }));
    });

    this.setSession({
      ...session,
      phase: 'uploading',
      startedAt: Date.now(),
    });

    this.pumpQueue();
  }

  cancelAll(): void {
    this.cancelled = true;
    this.activeTransfers.forEach((s) => s.unsubscribe());
    this.activeTransfers = [];

    const session = this.state$.value;
    if (!session) {
      return;
    }
    const groups = session.groups.map((g) => ({
      ...g,
      items: g.items.map((i) =>
        i.phase === 'completed' ? i : { ...i, phase: 'cancelled' as UploadPhase },
      ),
      phase:
        g.items.every((i) => i.phase === 'completed')
          ? ('completed' as UploadPhase)
          : ('cancelled' as UploadPhase),
    }));

    this.setSession({
      ...session,
      groups,
      phase: 'cancelled',
      finishedAt: Date.now(),
      activeUploads: 0,
    });
  }

  retryItem(itemId: string): void {
    const entry = this.itemIndex.get(itemId);
    if (!entry) return;
    const { item } = entry;
    if (item.phase !== 'failed') return;

    item.phase = 'queued';
    item.bytesUploaded = 0;
    item.chunksUploaded = 0;
    item.progress = 0;
    item.errorMessage = undefined;
    item.retries += 1;

    this.queue.unshift(item);
    this.recomputeAndEmit();
    this.pumpQueue();
  }

  reset(): void {
    this.cancelAll();
    this.queue = [];
    this.itemIndex.clear();
    this.state$.next(null);
  }

  private pumpQueue(): void {
    if (this.cancelled) return;

    const session = this.state$.value;
    if (!session) return;

    while (
      session.activeUploads < this.limits.maxConcurrentUploads &&
      this.queue.length > 0
    ) {
      const next = this.queue.shift()!;
      if (next.phase !== 'queued') continue;
      this.runTransport(next);
    }

    this.recomputeAndEmit();

    const allDone = Array.from(this.itemIndex.values()).every(
      ({ item }) =>
        item.phase === 'completed' ||
        item.phase === 'failed' ||
        item.phase === 'cancelled',
    );

    if (allDone && this.queue.length === 0) {
      const anyFailed = Array.from(this.itemIndex.values()).some(
        ({ item }) => item.phase === 'failed',
      );
      const finalPhase: UploadPhase = anyFailed ? 'failed' : 'completed';
      const current = this.state$.value;
      if (current) {
        this.setSession({
          ...current,
          phase: finalPhase,
          finishedAt: Date.now(),
        });
      }
    }
  }

  private runTransport(item: UploadItem): void {
    item.phase = 'validating';
    this.events$.next(item);

    const session = this.state$.value!;
    this.setSession({ ...session, activeUploads: session.activeUploads + 1 });

    const sub = this.transport
      .upload({
        id: item.id,
        fileName: item.fileName,
        relativePath: item.relativePath,
        sizeBytes: item.sizeBytes,
        retries: item.retries,
      })
      .subscribe({
        next: (event) => {
          if (this.cancelled) return;
          switch (event.kind) {
            case 'progress':
              item.phase = 'uploading';
              item.bytesUploaded = event.progress.bytesUploaded;
              item.chunksUploaded = event.progress.chunkIndex;
              item.chunkCount = event.progress.chunkCount;
              item.progress = event.progress.progressPercent;
              this.events$.next(item);
              this.recomputeAndEmit();
              break;
            case 'processing':
              item.phase = 'processing';
              this.recomputeAndEmit();
              break;
            case 'completed':
              item.phase = 'completed';
              item.progress = 100;
              item.bytesUploaded = item.sizeBytes;
              this.finishItem(item);
              break;
            case 'failed':
              item.phase = 'failed';
              item.errorMessage = event.error;
              this.finishItem(item);
              break;
          }
        },
        error: (err) => {
          item.phase = 'failed';
          item.errorMessage = err?.message ?? 'Transport error';
          this.finishItem(item);
        },
      });

    this.activeTransfers.push(sub);
  }

  private finishItem(item: UploadItem): void {
    const session = this.state$.value;
    if (session) {
      this.setSession({
        ...session,
        activeUploads: Math.max(0, session.activeUploads - 1),
      });
    }
    this.events$.next(item);
    this.pumpQueue();
  }

  private recomputeAndEmit(): void {
    const session = this.state$.value;
    if (!session) return;

    let uploadedSize = 0;
    const groups = session.groups.map((g) => {
      const uploaded = g.items.reduce((s, i) => s + i.bytesUploaded, 0);
      const total = g.totalSize || 1;
      const progress = Math.round((uploaded / total) * 100);

      const phase: UploadPhase = g.items.every((i) => i.phase === 'completed')
        ? 'completed'
        : g.items.some((i) => i.phase === 'failed')
          ? 'failed'
          : g.items.some((i) => i.phase === 'uploading' || i.phase === 'processing')
            ? 'uploading'
            : 'queued';

      uploadedSize += uploaded;
      return { ...g, uploadedSize: uploaded, progress, phase };
    });

    const overallProgress = Math.round((uploadedSize / Math.max(session.totalSize, 1)) * 100);
    this.setSession({
      ...session,
      groups,
      uploadedSize,
      overallProgress,
    });
  }

  private setSession(s: UploadSessionState): void {
    this.state$.next(s);
  }

  private toItem(file: File, index: number): UploadItem {
    const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const chunks = Math.max(1, Math.ceil(file.size / this.limits.chunkSizeBytes));
    return {
      id: `ITEM-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      fileName: file.name,
      relativePath: relPath,
      sizeBytes: file.size,
      bytesUploaded: 0,
      progress: 0,
      phase: 'queued',
      chunkCount: chunks,
      chunksUploaded: 0,
      retries: 0,
    };
  }

  private extension(name: string): string {
    const m = name.match(/\.[^.]+$/);
    return m ? m[0] : '';
  }

  private bytesToMb(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(1);
  }

  private guessBiddersFromZipName(name: string): string[] {
    const seed = name.toLowerCase();
    if (seed.includes('infra') || seed.includes('highway')) {
      return [
        'Constellation Infrastructure Ltd',
        'Meridian Road Builders Pvt Ltd',
        'Sagara Construction Co',
        'Prabhat Engineering Works',
      ];
    }
    if (seed.includes('water')) {
      return [
        'Hydrotech Engineers Ltd',
        'AquaCore Industries',
        'Bharat Water Works',
      ];
    }
    return ['Bidder A', 'Bidder B', 'Bidder C'];
  }
}
