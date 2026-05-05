import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Observable, merge, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BIDDER_REPOSITORY } from '../../core/abstractions/bidder-repository';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import { ProcessedTender } from '../../core/models/evaluation.models';
import { LoadState, toLoadState } from '../../core/models/load-state';
import {
  IN_PROGRESS_BUCKETS,
  TenderStatusDescriptor,
  describeStatus,
  isInProgress,
  progressForStatus,
} from '../../core/registry/tender-status.registry';
import { AppRoutes } from '../../core/routing/app-routes';
import { RefreshBus } from '../../core/services/refresh-bus';
import {
  BreadcrumbComponent,
  BreadcrumbSegment,
} from '../../shared/breadcrumb/breadcrumb.component';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';
import { BidderFormComponent } from '../uploads/bidder-form/bidder-form.component';

type BucketFilter = 'all' | TenderStatusDescriptor['bucket'];
type SortKey = 'progress' | 'closing' | 'stage' | 'bidders';

interface EvaluationRow {
  tender: ProcessedTender;
  descriptor: TenderStatusDescriptor;
  progress: number;
}

@Component({
  selector: 'app-evaluations',
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
    MatProgressBarModule,
    MatSelectModule,
    BreadcrumbComponent,
    LoadingPanelComponent,
  ],
  templateUrl: './evaluations.component.html',
  styleUrl: './evaluations.component.scss',
})
export class EvaluationsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly refresh = inject(RefreshBus);
  private readonly dialog = inject(MatDialog);

  readonly routes = AppRoutes;
  readonly crumbs: BreadcrumbSegment[] = [{ label: 'Evaluations in progress' }];

  rows: EvaluationRow[] = [];
  state$!: Observable<LoadState<ProcessedTender[]>>;

  activeFilter: BucketFilter = 'all';
  sortBy: SortKey = 'progress';

  ngOnInit(): void {
    // Pipe the list call through the refresh bus so any mutation elsewhere
    // (bidder added, status changed) re-reads and re-renders automatically.
    const source$ = merge(of(null), this.refresh.tenders$).pipe(
      switchMap(() => this.tenderRepo.list()),
    );
    this.state$ = toLoadState(source$);
    this.state$.subscribe((s) => {
      if (s.status !== 'success') return;
      this.rows = s.data
        .filter((t) => isInProgress(t.status))
        .map((t) => ({
          tender: t,
          descriptor: describeStatus(t.status),
          progress: progressForStatus(t.status),
        }));
    });
  }

  get filteredSorted(): EvaluationRow[] {
    const filtered =
      this.activeFilter === 'all'
        ? this.rows
        : this.rows.filter((r) => r.descriptor.bucket === this.activeFilter);

    const sorted = [...filtered];
    switch (this.sortBy) {
      case 'progress':
        sorted.sort((a, b) => b.progress - a.progress);
        break;
      case 'closing':
        sorted.sort((a, b) =>
          a.tender.closingDate.localeCompare(b.tender.closingDate),
        );
        break;
      case 'stage':
        sorted.sort((a, b) =>
          a.descriptor.label.localeCompare(b.descriptor.label),
        );
        break;
      case 'bidders':
        sorted.sort((a, b) => b.tender.biddersCount - a.tender.biddersCount);
        break;
    }
    return sorted;
  }

  countFor(filter: BucketFilter): number {
    if (filter === 'all') return this.rows.length;
    return this.rows.filter((r) => r.descriptor.bucket === filter).length;
  }

  setFilter(filter: BucketFilter): void {
    this.activeFilter = filter;
  }

  openAction(row: EvaluationRow): void {
    switch (row.descriptor.actionRoute) {
      case 'add-bidder-dialog':
        this.openAddBidderDialog(row.tender);
        return;
      case 'upload':
        this.router.navigate(AppRoutes.upload());
        return;
      case 'tender-bidders':
      default:
        this.router.navigate(AppRoutes.tenderBidders(row.tender.id));
    }
  }

  openDetail(row: EvaluationRow): void {
    this.router.navigate(AppRoutes.tenderBidders(row.tender.id));
  }

  private openAddBidderDialog(tender: ProcessedTender): void {
    const ref = this.dialog.open(BidderFormComponent, {
      width: '960px',
      maxWidth: '92vw',
      minHeight: '68vh',
      maxHeight: '92vh',
      panelClass: 'ite-bidder-dialog',
      data: { tenderId: tender.id, tenderName: tender.name },
    });

    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.bidderRepo
        .addBidderToTender(tender.id, {
          bidderName: result.bidderName ?? 'New bidder',
          uploadMode: result.uploadMode ?? 'folder',
          fileCount: result.groups?.reduce(
            (sum: number, g: { fileCount?: number }) =>
              sum + (g.fileCount ?? 0),
            0,
          ),
          totalSizeBytes: result.groups?.reduce(
            (sum: number, g: { totalSize?: number }) =>
              sum + (g.totalSize ?? 0),
            0,
          ),
        })
        .subscribe();
    });
  }

  // Exposed so the template can render the three bucket chips in fixed order.
  readonly buckets = IN_PROGRESS_BUCKETS;

  bucketLabel(bucket: TenderStatusDescriptor['bucket']): string {
    switch (bucket) {
      case 'waiting-for-bidders':
        return 'Waiting for bidders';
      case 'being-evaluated':
        return 'Being evaluated';
      case 'ready-for-review':
        return 'Ready for review';
      default:
        return bucket;
    }
  }

  bucketTone(bucket: TenderStatusDescriptor['bucket']): string {
    switch (bucket) {
      case 'waiting-for-bidders':
        return 'ite-status--partial';
      case 'being-evaluated':
        return 'ite-status--neutral';
      case 'ready-for-review':
        return 'ite-status--pass';
      default:
        return 'ite-status--neutral';
    }
  }
}
