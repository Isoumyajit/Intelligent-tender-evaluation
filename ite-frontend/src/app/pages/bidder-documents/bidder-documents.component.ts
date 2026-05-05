import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { BIDDER_REPOSITORY } from '../../core/abstractions/bidder-repository';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import {
  BidderDocument,
  BidderDocumentCategory,
  BidderSummary,
  ProcessedTender,
} from '../../core/models/evaluation.models';
import { LoadState, toLoadState } from '../../core/models/load-state';
import { FileSizePipe } from '../../core/pipes/file-size.pipe';
import { AppRoutes } from '../../core/routing/app-routes';
import {
  BreadcrumbComponent,
  BreadcrumbSegment,
} from '../../shared/breadcrumb/breadcrumb.component';
import { DocumentViewerComponent } from '../../shared/document-viewer/document-viewer.component';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';

interface DocumentsData {
  tender: ProcessedTender | undefined;
  bidder: BidderSummary | undefined;
  documents: BidderDocument[];
}

const CATEGORY_ORDER: BidderDocumentCategory[] = [
  'Eligibility',
  'Technical',
  'Financial',
  'Compliance',
  'Other',
];

@Component({
  selector: 'app-bidder-documents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    BreadcrumbComponent,
    DocumentViewerComponent,
    FileSizePipe,
    LoadingPanelComponent,
  ],
  templateUrl: './bidder-documents.component.html',
  styleUrl: './bidder-documents.component.scss',
})
export class BidderDocumentsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);

  readonly routes = AppRoutes;
  readonly categories = CATEGORY_ORDER;

  tender: ProcessedTender | null = null;
  bidder: BidderSummary | null = null;
  documents: BidderDocument[] = [];
  crumbs: BreadcrumbSegment[] = [];
  state$!: Observable<LoadState<DocumentsData>>;

  filter = '';
  activeCategory: BidderDocumentCategory | 'All' = 'All';
  selectedDocument: BidderDocument | null = null;

  ngOnInit(): void {
    const tenderId = this.route.snapshot.paramMap.get('tenderId')!;
    const bidderId = this.route.snapshot.paramMap.get('bidderId')!;

    const combined$ = forkJoin({
      tender: this.tenderRepo.getById(tenderId),
      bidders: this.bidderRepo.listForTender(tenderId),
      documents: this.bidderRepo.listDocuments(tenderId, bidderId),
    }).pipe(
      map((data) => ({
        tender: data.tender,
        bidder: data.bidders.find((b) => b.id === bidderId),
        documents: data.documents,
      })),
    );

    this.state$ = toLoadState(combined$);
    this.state$.subscribe((s) => {
      if (s.status !== 'success') return;
      const { tender, bidder, documents } = s.data;
      this.tender = tender ?? null;
      this.bidder = bidder ?? null;
      this.documents = documents;

      if (tender && bidder) {
        this.crumbs = [
          { label: 'Tender List', link: AppRoutes.tenders() },
          {
            label: tender.name,
            link: AppRoutes.tenderBidders(tender.id),
          },
          { label: bidder.name },
          { label: 'Documents' },
        ];
      }
    });
  }

  get filteredDocuments(): BidderDocument[] {
    const q = this.filter.trim().toLowerCase();
    return this.documents.filter((d) => {
      const matchesCat =
        this.activeCategory === 'All' || d.category === this.activeCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        d.fileName.toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }

  get totalSize(): number {
    return this.documents.reduce((s, d) => s + d.sizeBytes, 0);
  }

  countFor(category: BidderDocumentCategory | 'All'): number {
    if (category === 'All') return this.documents.length;
    return this.documents.filter((d) => d.category === category).length;
  }

  setCategory(category: BidderDocumentCategory | 'All'): void {
    this.activeCategory = category;
  }

  openDocument(doc: BidderDocument): void {
    this.selectedDocument = doc;
  }

  closeViewer(): void {
    this.selectedDocument = null;
  }

  iconForMime(mime: string): string {
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'picture_as_pdf';
    if (mime.includes('word')) return 'description';
    if (mime.includes('excel') || mime.includes('spreadsheet')) {
      return 'table_chart';
    }
    if (mime.includes('presentation')) return 'slideshow';
    return 'insert_drive_file';
  }

  /** Categories are informational labels, not pass/partial/fail states —
   *  keep them on the neutral chip tone so they don't imply a judgement. */
  categoryClass(_category: BidderDocumentCategory): string {
    return 'ite-status--neutral';
  }
}
