import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, merge, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { BIDDER_REPOSITORY } from '../../core/abstractions/bidder-repository';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import { LoadState, toLoadState } from '../../core/models/load-state';
import { ProcessedTender } from '../../core/models/evaluation.models';
import { describeStatus } from '../../core/registry/tender-status.registry';
import { AppRoutes } from '../../core/routing/app-routes';
import { RefreshBus } from '../../core/services/refresh-bus';
import { TenderEvaluationProgressService } from '../../core/services/tender-evaluation-progress.service';
import {
  TenderStage,
  TenderStageStore,
} from '../../core/services/tender-stage.store';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';
import { BidderFormComponent } from '../uploads/bidder-form/bidder-form.component';

type StageFilter = 'all' | TenderStage;

@Component({
  selector: 'app-tender-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    BreadcrumbComponent,
    LoadingPanelComponent,
  ],
  templateUrl: './tender-list.component.html',
  styleUrl: './tender-list.component.scss',
})
export class TenderListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly refresh = inject(RefreshBus);
  private readonly stages = inject(TenderStageStore);
  private readonly progress = inject(TenderEvaluationProgressService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly routes = AppRoutes;
  tenders: ProcessedTender[] = [];
  filter = '';
  stageFilter: StageFilter = 'all';
  state$!: Observable<LoadState<ProcessedTender[]>>;

  readonly crumbs = [{ label: 'Tenders' }];

  ngOnInit() {
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
      if (s.status === 'success') this.tenders = s.data;
    });
  }

  get totalBidders(): number {
    return this.tenders.reduce((sum, t) => sum + t.biddersCount, 0);
  }

  get filtered(): ProcessedTender[] {
    const q = this.filter.trim().toLowerCase();
    return this.tenders.filter((t) => {
      if (this.stageFilter !== 'all' && this.stageOf(t) !== this.stageFilter) {
        return false;
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.authority.toLowerCase().includes(q)
      );
    });
  }

  stageOf(tender: ProcessedTender): TenderStage {
    return this.stages.get(tender.id);
  }

  progressOf(tender: ProcessedTender): Observable<number> {
    return this.progress.progress$(tender.id);
  }

  countFor(stage: StageFilter): number {
    if (stage === 'all') return this.tenders.length;
    return this.tenders.filter((t) => this.stageOf(t) === stage).length;
  }

  /** Gate for Start / Re-run evaluation: must have at least one bidder. */
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
    this.progress.start(tender.id);
    this.snack.open(`Evaluation started for "${tender.name}".`, 'Dismiss', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  reRunEvaluation(tender: ProcessedTender, event?: Event): void {
    event?.stopPropagation();
    if (!this.canEvaluate(tender)) return;
    this.progress.start(tender.id);
    this.snack.open(`Evaluation re-run for "${tender.name}".`, 'Dismiss', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom',
    });
  }

  openAddBidder(tender: ProcessedTender, event?: Event): void {
    event?.stopPropagation();
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

  openBidders(tender: ProcessedTender, event?: Event) {
    event?.stopPropagation();
    this.router.navigate(AppRoutes.tenderBidders(tender.id));
  }

  describe(status: ProcessedTender['status']) {
    return describeStatus(status);
  }

  stageLabel(stage: StageFilter): string {
    switch (stage) {
      case 'all':
        return 'All tenders';
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
}
