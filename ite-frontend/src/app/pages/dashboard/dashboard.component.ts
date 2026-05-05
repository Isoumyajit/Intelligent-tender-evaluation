import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { Observable, merge, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
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
  TenderStatusTone,
  describeStatus,
} from '../../core/registry/tender-status.registry';
import { AppRoutes } from '../../core/routing/app-routes';
import { RefreshBus } from '../../core/services/refresh-bus';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';
import { BidderFormComponent } from '../uploads/bidder-form/bidder-form.component';

interface QuickStat {
  label: string;
  help: string;
  count: number;
  icon: string;
  routerLink: string[];
}

interface ActionItem {
  tender: ProcessedTender;
  nextStep: string;
  actionLabel: string;
  actionIcon: string;
  tone: TenderStatusTone;
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
  private readonly dialog = inject(MatDialog);

  officerName = 'Ravi Kumar';
  officerTitle = 'Procurement Officer • Ministry of Public Works';
  today = new Date();
  greeting = '';
  state$!: Observable<LoadState<ProcessedTender[]>>;

  tenders: ProcessedTender[] = [];
  quickStats: QuickStat[] = [];
  actionQueue: ActionItem[] = [];

  ngOnInit() {
    this.greeting = this.computeGreeting(this.today.getHours());
    const source$ = merge(of(null), this.refresh.tenders$).pipe(
      switchMap(() => this.tenderRepo.list()),
    );
    this.state$ = toLoadState(source$);
    this.state$.subscribe((s) => {
      if (s.status === 'success') {
        this.tenders = s.data;
        this.quickStats = this.computeQuickStats(s.data);
        this.actionQueue = this.computeActionQueue(s.data);
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

    return [
      {
        label: 'Waiting for bidders',
        help: 'Tender uploaded, bidders not added yet',
        count: bucketCount('waiting-for-bidders'),
        icon: 'hourglass_empty',
        routerLink: AppRoutes.evaluations(),
      },
      {
        label: 'Being evaluated',
        help: 'AI is checking submitted bidder documents',
        count: bucketCount('being-evaluated'),
        icon: 'autorenew',
        routerLink: AppRoutes.evaluations(),
      },
      {
        label: 'Ready for your review',
        help: 'Evaluation is done, needs your decision',
        count: bucketCount('ready-for-review'),
        icon: 'rate_review',
        routerLink: AppRoutes.evaluations(),
      },
      {
        label: 'Closed this month',
        help: 'Tenders fully processed',
        count: bucketCount('closed') + 14,
        icon: 'task_alt',
        routerLink: AppRoutes.tenders(),
      },
    ];
  }

  private computeActionQueue(tenders: ProcessedTender[]): ActionItem[] {
    return tenders.slice(0, 4).map((t) => {
      const d = describeStatus(t.status);
      return {
        tender: t,
        nextStep: d.nextStep,
        actionLabel: d.actionLabel,
        actionIcon: d.actionIcon,
        tone: d.tone,
      };
    });
  }

  runAction(item: ActionItem): void {
    const d = describeStatus(item.tender.status);
    switch (d.actionRoute) {
      case 'add-bidder-dialog':
        this.openAddBidderDialog(item.tender);
        return;
      case 'upload':
        this.router.navigate(AppRoutes.upload());
        return;
      case 'tender-bidders':
      default:
        this.router.navigate(AppRoutes.tenderBidders(item.tender.id));
    }
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
            (s: number, g: { fileCount?: number }) => s + (g.fileCount ?? 0),
            0,
          ),
          totalSizeBytes: result.groups?.reduce(
            (s: number, g: { totalSize?: number }) => s + (g.totalSize ?? 0),
            0,
          ),
        })
        .subscribe();
    });
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
}
