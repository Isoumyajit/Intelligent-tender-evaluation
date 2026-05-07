import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { Observable, forkJoin, merge, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { BIDDER_REPOSITORY } from '../../core/abstractions/bidder-repository';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import {
  LoadState,
  toLoadState,
} from '../../core/models/load-state';
import {
  ProcessedTender,
} from '../../core/models/evaluation.models';
import {
  TENDER_STATUS_DESCRIPTORS,
  describeStatus,
} from '../../core/registry/tender-status.registry';
import { AppRoutes } from '../../core/routing/app-routes';
import { RefreshBus } from '../../core/services/refresh-bus';
import { TenderStage, TenderStageStore } from '../../core/services/tender-stage.store';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';

interface QuickStat {
  label: string;
  help: string;
  count: number;
  icon: string;
  routerLink: string[];
  /** Optional query param passed to the destination page so the tile
   *  can seed a filter without the user touching chips on arrival. */
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    LoadingPanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly refresh = inject(RefreshBus);
  private readonly stages = inject(TenderStageStore);

  officerName = 'Ravi Kumar';
  officerTitle = 'Procurement Officer • Ministry of Public Works';
  today = new Date();
  greeting = '';
  state$!: Observable<LoadState<ProcessedTender[]>>;

  tenders: ProcessedTender[] = [];
  quickStats: QuickStat[] = [];

  ngOnInit() {
    this.greeting = this.computeGreeting(this.today.getHours());
    // Backend doesn't expose bidder count on the tender list row, so we
    // fan out /tenders/{id}/bid/ after the list returns and stitch the
    // counts back in. Same pattern as the Evaluations + Tenders pages.
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
      if (s.status === 'success') {
        this.tenders = s.data;
        this.quickStats = this.computeQuickStats(s.data);
      }
    });
  }

  private computeGreeting(hour: number): string {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  private computeQuickStats(tenders: ProcessedTender[]): QuickStat[] {
    const bucketCount = (
      bucket: ReturnType<typeof describeStatus>['bucket'],
    ): number =>
      tenders.filter((t) => describeStatus(t.status).bucket === bucket).length;

    const waitingCount = tenders.filter(
      (t) =>
        describeStatus(t.status).bucket === 'waiting-for-bidders' &&
        t.biddersCount === 0,
    ).length;

    return [
      {
        label: 'Waiting for bidders',
        help: 'Tender uploaded, bidders not added yet',
        count: waitingCount,
        icon: 'hourglass_empty',
        routerLink: AppRoutes.evaluations(),
        queryParams: { bucket: 'waiting-for-bidders' },
      },
      {
        label: 'Being evaluated',
        help: 'AI is checking submitted bidder documents',
        count: bucketCount('being-evaluated'),
        icon: 'autorenew',
        routerLink: AppRoutes.evaluations(),
        queryParams: { bucket: 'being-evaluated' },
      },
      {
        label: 'Ready to evaluate',
        help: 'Bidder submissions added, evaluation not started',
        count: tenders.filter(
          (t) => describeStatus(t.status).bucket === 'waiting-for-bidders' && t.biddersCount > 0
        ).length,
        icon: 'play_arrow',
        routerLink: AppRoutes.evaluations(),
        queryParams: { bucket: 'ready-to-evaluate' },
      },
      {
        label: 'Closed',
        help: 'Tenders fully processed',
        count: bucketCount('closed'),
        icon: 'task_alt',
        routerLink: AppRoutes.tenders(),
      },
    ];
  }

  /** Exposed for template to render the registry-driven status legend. */
  readonly descriptors = TENDER_STATUS_DESCRIPTORS;
  readonly routes = AppRoutes;

  describe(status: ProcessedTender['status']) {
    return describeStatus(status);
  }

  navigateToUpload() {
    this.router.navigate(AppRoutes.upload());
  }

  navigateToTenders() {
    this.router.navigate(AppRoutes.tenders());
  }

  navigateToReady() {
    this.router.navigate(AppRoutes.tenders());
  }

  stageOf(tender: ProcessedTender): TenderStage {
    return this.stages.get(tender.id);
  }

  stageLabel(stage: TenderStage): string {
    switch (stage) {
      case 'fresh': return 'Pending Review';
      case 'in-evaluation': return 'Being Evaluated';
      case 'evaluated': return 'Evaluated';
      case 'closed': return 'Closed';
    }
  }

  stageTone(stage: TenderStage): string {
    switch (stage) {
      case 'fresh': return 'ite-status--partial';
      case 'in-evaluation': return 'ite-status--neutral';
      case 'evaluated': return 'ite-status--pass';
      case 'closed': return 'ite-status--neutral';
    }
  }
}
