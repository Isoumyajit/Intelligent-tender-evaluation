import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import { DOCUMENT_RENDERER } from '../../core/abstractions/document-renderer';
import { ViewerShortcutService } from './services/viewer-shortcuts.service';
import {
  FitMode,
  Rotation,
  ViewerState,
  ViewerStateService,
} from './services/viewer-state.service';
import { ViewerToolbarComponent } from './toolbar/viewer-toolbar.component';

/**
 * Document viewer shell. Is entirely decoupled from the actual document
 * rendering implementation via the DOCUMENT_RENDERER injection token — the
 * component just asks the token for a page, receives a Blob, and displays it.
 *
 * Layers are composed inside `.stage`:
 *   [image layer]  <- the rendered page
 *   [highlight layer]  <- ng-content projection point for bbox overlays
 *                        (coordinates plug in later; the slot is ready)
 *
 * State is owned by ViewerStateService. Components must provide it at the
 * component level (done here) so multiple viewer instances don't share state.
 */
@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ViewerToolbarComponent,
  ],
  providers: [ViewerStateService, ViewerShortcutService],
  templateUrl: './document-viewer.component.html',
  styleUrl: './document-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentViewerComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  private readonly renderer = inject(DOCUMENT_RENDERER);
  private readonly state = inject(ViewerStateService);
  private readonly shortcuts = inject(ViewerShortcutService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) documentId!: string;
  @Input() initialPage = 1;

  @Output() readonly closed = new EventEmitter<void>();

  @ViewChild('stage', { static: false })
  stageRef: ElementRef<HTMLElement> | null = null;

  @HostBinding('class.viewer--fullscreen')
  fullscreen = false;

  pageImageUrl: string | null = null;
  pageNaturalWidth = 0;
  pageNaturalHeight = 0;

  loading = false;
  errorMessage: string | null = null;

  totalPages = 0;
  currentPage = 1;
  zoom = 1;
  rotation: Rotation = 0;
  fitMode: FitMode = 'width';

  private subs = new Subscription();
  private activePageSub: Subscription | null = null;
  private activeObjectUrl: string | null = null;

  ngOnInit(): void {
    this.shortcuts.enable();

    this.subs.add(
      this.state.changes$.subscribe((s) => {
        this.syncFromState(s);
        this.cdr.markForCheck();
      }),
    );
  }

  ngAfterViewInit(): void {
    this.loadDocument();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.documentId) return;
    if (changes['documentId'] && !changes['documentId'].firstChange) {
      this.loadDocument();
    } else if (changes['initialPage'] && !changes['initialPage'].firstChange) {
      const newPage = changes['initialPage'].currentValue ?? 1;
      if (this.state.snapshot.totalPages > 0 && newPage !== this.currentPage) {
        this.state.setPage(newPage);
      }
    }
  }

  ngOnDestroy(): void {
    this.shortcuts.disable();
    this.subs.unsubscribe();
    this.activePageSub?.unsubscribe();
    this.revokeObjectUrl();
  }

  onClose(): void {
    this.closed.emit();
  }

  pageTransform(): string {
    const rot = this.rotation;
    const base = `rotate(${rot}deg)`;
    if (this.fitMode === 'none') {
      return `${base} scale(${this.zoom})`;
    }
    // In fit modes the image dimensions are driven by CSS width/height,
    // so we only apply rotation.
    return base;
  }

  pageSizingClass(): string {
    switch (this.fitMode) {
      case 'width':
        return 'fit-width';
      case 'page':
        return 'fit-page';
      default:
        return 'fit-none';
    }
  }

  private loadDocument(): void {
    this.errorMessage = null;
    this.loading = true;
    this.state.reset();
    this.cdr.markForCheck();

    this.subs.add(
      this.renderer.getMetadata(this.documentId).subscribe({
        next: (meta) => {
          this.state.init(this.documentId, meta.totalPages);
          this.state.setPage(Math.min(this.initialPage, meta.totalPages || 1));
          this.loadPage(this.state.snapshot.currentPage);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.message ?? 'Unable to load document';
          this.cdr.markForCheck();
        },
      }),
    );
  }

  private loadPage(pageNumber: number): void {
    this.loading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.activePageSub?.unsubscribe();
    this.activePageSub = this.renderer
      .renderPage(this.documentId, pageNumber)
      .subscribe({
        next: (rendered) => {
          this.revokeObjectUrl();
          this.activeObjectUrl = URL.createObjectURL(rendered.blob);
          this.pageImageUrl = this.activeObjectUrl;
          this.pageNaturalWidth = rendered.naturalWidth ?? 0;
          this.pageNaturalHeight = rendered.naturalHeight ?? 0;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.message ?? 'Unable to render this page';
          this.cdr.markForCheck();
        },
      });
  }

  private syncFromState(s: ViewerState): void {
    const pageChanged = s.currentPage !== this.currentPage;
    this.totalPages = s.totalPages;
    this.currentPage = s.currentPage;
    this.zoom = s.zoom;
    this.rotation = s.rotation;
    this.fitMode = s.fitMode;
    this.fullscreen = s.fullscreen;

    if (pageChanged && s.documentId) {
      this.loadPage(s.currentPage);
    }
  }

  private revokeObjectUrl(): void {
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
  }
}
