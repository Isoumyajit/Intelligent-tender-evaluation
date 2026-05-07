import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import {
  CriterionStatus,
  DocumentEvidence,
  EvaluationCriterion,
} from '../../core/models/evaluation.models';
import { DocumentViewerComponent } from '../document-viewer/document-viewer.component';

/**
 * Inline side panel that renders the extracted evidence for a criterion
 * as a simulated document page with the matching region highlighted.
 *
 * Intended to live as a sibling of the main report content inside a
 * split-layout grid: when the parent sets its grid template to "1fr
 * 1fr" the panel simply occupies its column; when it sets "1fr 0fr"
 * the panel collapses. No fixed/absolute positioning, no backdrop.
 *
 * The inner .page-sheet + .highlight markup is the Phase 1 stand-in
 * for a real pdf.js viewer with bounding-box overlays (Phase 2+).
 */
@Component({
  selector: 'app-evidence-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    DocumentViewerComponent,
  ],
  templateUrl: './evidence-panel.component.html',
  styleUrl: './evidence-panel.component.scss',
})
export class EvidencePanelComponent implements OnChanges {
  @Input() criterion: EvaluationCriterion | null = null;
  @Output() closed = new EventEmitter<void>();

  selectedDocIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['criterion']) {
      this.selectedDocIndex = 0;
    }
  }

  get selectedEvidence() {
    return this.criterion?.evidence[this.selectedDocIndex] ?? null;
  }

  selectDoc(index: number): void {
    this.selectedDocIndex = index;
  }

  docDisplayName(ev: DocumentEvidence): string {
    return ev.fileName || ev.documentName.split('/').pop() || ev.documentName;
  }

  statusClass(status: CriterionStatus): string {
    if (status === 'passed') return 'ite-status--pass';
    if (status === 'failed' || status === 'missing-document') return 'ite-status--fail';
    return 'ite-status--partial';
  }

  reasonClass(status: CriterionStatus): string {
    if (status === 'passed') return 'evidence-panel__reason--pass';
    if (status === 'failed' || status === 'missing-document') return 'evidence-panel__reason--fail';
    return 'evidence-panel__reason--review';
  }

  reasonIcon(status: CriterionStatus): string {
    if (status === 'passed') return 'check_circle';
    if (status === 'failed' || status === 'missing-document') return 'error';
    return 'info';
  }

  statusLabel(status: CriterionStatus): string {
    if (status === 'passed') return 'Passed';
    if (status === 'failed') return 'Not matched';
    if (status === 'missing-document') return 'Document not submitted';
    return 'Review required';
  }

  statusIcon(status: CriterionStatus): string {
    if (status === 'passed') return 'check_circle';
    if (status === 'failed') return 'cancel';
    if (status === 'missing-document') return 'file_present';
    return 'error';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.criterion) this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
