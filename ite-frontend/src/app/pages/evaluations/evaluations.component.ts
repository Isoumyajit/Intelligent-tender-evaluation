import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Observable, forkJoin, merge, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
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
import { TenderEvaluationProgressService } from '../../core/services/tender-evaluation-progress.service';
import {
  TenderStage,
  TenderStageStore,
} from '../../core/services/tender-stage.store';
import {
  BreadcrumbComponent,
  BreadcrumbSegment,
} from '../../shared/breadcrumb/breadcrumb.component';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';
import { BidderFormComponent } from '../uploads/bidder-form/bidder-form.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

type BucketFilter = 'all' | TenderStatusDescriptor['bucket'];
type SortKey = 'progress' | 'stage' | 'bidders';

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
    MatSnackBarModule,
    MatTooltipModule,
    BreadcrumbComponent,
    LoadingPanelComponent,
  ],
  templateUrl: './evaluations.component.html',
  styleUrl: './evaluations.component.scss',
})
export class EvaluationsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly refresh = inject(RefreshBus);
  private readonly dialog = inject(MatDialog);
  private readonly stages = inject(TenderStageStore);
  private readonly progressSvc = inject(TenderEvaluationProgressService);
  private readonly snack = inject(MatSnackBar);

  readonly routes = AppRoutes;
  readonly crumbs: BreadcrumbSegment[] = [{ label: 'Evaluations in progress' }];

  rows: EvaluationRow[] = [];
  state$!: Observable<LoadState<ProcessedTender[]>>;

  activeFilter: BucketFilter = 'all';
  sortBy: SortKey = 'progress';

  ngOnInit(): void {
    // Deep-link: dashboard tiles can pass ?bucket=<id> to preselect a
    // filter so clicking "Waiting for bidders" shows only those.
    this.route.queryParamMap.subscribe((params) => {
      const requested = params.get('bucket');
      this.activeFilter = this.isValidFilter(requested) ? requested : 'all';
    });

    // Pipe the list call through the refresh bus so any mutation elsewhere
    // (bidder added, status changed) re-reads and re-renders automatically.
    // After the tender list arrives, fan out one bid-list call per tender
    // so we can show a real bidder count — the backend doesn't include it
    // on the list row.
    const source$ = merge(of(null), this.refresh.tenders$).pipe(
      switchMap(() => this.tenderRepo.list()),
      switchMap((tenders) =>
        tenders.length === 0
          ? of([] as ProcessedTender[])
          : forkJoin(
              tenders.map((t) =>
                this.bidderRepo.listForTender(t.id).pipe(
                  map((bidders) => ({ ...t, biddersCount: bidders.length })),
                ),
              ),
            ),
      ),
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

    this.progressSvc.errors$.subscribe(({ message }) => {
      this.snack.open(message, 'Dismiss', {
        duration: 6000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
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
      case 'stage':
        sorted.sort((a, b) =>
          this.stageLabel(this.stageOf(a.tender)).localeCompare(
            this.stageLabel(this.stageOf(b.tender)),
          ),
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
    // Mirror the choice into the URL so reloading or sharing the link
    // preserves the filter. 'all' removes the param for a clean URL.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { bucket: filter === 'all' ? null : filter },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private isValidFilter(value: string | null): value is BucketFilter {
    return (
      value === 'all' ||
      value === 'waiting-for-bidders' ||
      value === 'being-evaluated' ||
      value === 'ready-for-review'
    );
  }

  openDetail(row: EvaluationRow, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(AppRoutes.tenderBidders(row.tender.id));
  }

  stageOf(tender: ProcessedTender): TenderStage {
    return this.stages.get(tender.id);
  }

  stageLabel(stage: TenderStage): string {
    switch (stage) {
      case 'fresh':
        return 'Fresh';
      case 'in-evaluation':
        return 'In evaluation';
      case 'evaluated':
        return 'Evaluated';
      case 'closed':
        return 'Closed';
    }
  }

  progressOf(tender: ProcessedTender): Observable<number> {
    return this.progressSvc.progress$(tender.id);
  }

  canEvaluate(tender: ProcessedTender): boolean {
    return tender.biddersCount > 0;
  }

  startEvaluation(tender: ProcessedTender, event?: Event): void {
    event?.stopPropagation();
    if (!this.canEvaluate(tender)) {
      this.snack.open(
        'Add at least one bidder before starting evaluation.',
        'Dismiss',
        { duration: 3500, horizontalPosition: 'end', verticalPosition: 'bottom' },
      );
      return;
    }
    this.progressSvc.start(tender.id);
    this.snack.open(`Evaluation started for "${tender.name}".`, 'Dismiss', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  reRunEvaluation(tender: ProcessedTender, event?: Event): void {
    event?.stopPropagation();
    if (!this.canEvaluate(tender)) return;
    this.progressSvc.start(tender.id);
    this.snack.open(`Evaluation re-run for "${tender.name}".`, 'Dismiss', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  openAddBidder(tender: ProcessedTender, event?: Event): void {
    event?.stopPropagation();
    this.openAddBidderDialog(tender);
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
          files: result.files ?? [],
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
