import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import {
  ViewerState,
  ViewerStateService,
} from '../services/viewer-state.service';

/**
 * Material-only viewer toolbar. Every button mutates ViewerStateService — the
 * toolbar holds no local state, which keeps it interchangeable with a future
 * alternate toolbar (say, a compact mobile bar) that speaks the same service.
 */
@Component({
  selector: 'app-viewer-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './viewer-toolbar.component.html',
  styleUrl: './viewer-toolbar.component.scss',
})
export class ViewerToolbarComponent {
  private readonly viewer = inject(ViewerStateService);
  readonly state$: Observable<ViewerState> = this.viewer.changes$;

  onPageInput(raw: string): void {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    this.viewer.setPage(n);
  }

  zoomIn(): void {
    this.viewer.zoomIn();
  }
  zoomOut(): void {
    this.viewer.zoomOut();
  }
  fitWidth(): void {
    this.viewer.setFit('width');
  }
  fitPage(): void {
    this.viewer.setFit('page');
  }
  rotate(): void {
    this.viewer.rotateBy(90);
  }
  next(): void {
    this.viewer.nextPage();
  }
  prev(): void {
    this.viewer.prevPage();
  }
  fullscreen(): void {
    this.viewer.toggleFullscreen();
  }

  zoomPercent(zoom: number): string {
    return `${Math.round(zoom * 100)}%`;
  }
}
