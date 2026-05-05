import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
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
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';

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
  route: string[];
  tone: TenderStatusTone;
}

interface WorkflowStep {
  number: number;
  title: string;
  description: string;
  icon: string;
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

  officerName = 'Ravi Kumar';
  officerTitle = 'Procurement Officer • Ministry of Public Works';
  today = new Date();
  greeting = '';
  state$!: Observable<LoadState<ProcessedTender[]>>;

  tenders: ProcessedTender[] = [];
  quickStats: QuickStat[] = [];
  actionQueue: ActionItem[] = [];

  readonly workflowSteps: WorkflowStep[] = [
    {
      number: 1,
      title: 'Upload tender document',
      description: 'Add the PDF or Word file of the tender notice.',
      icon: 'upload_file',
    },
    {
      number: 2,
      title: 'Add bidder submissions',
      description: 'Upload each bidder folder or a single ZIP archive.',
      icon: 'group_add',
    },
    {
      number: 3,
      title: 'AI checks the documents',
      description: 'The system extracts values and checks each criterion.',
      icon: 'auto_awesome',
    },
    {
      number: 4,
      title: 'You review and decide',
      description: 'Open the report, read the evidence, take a call.',
      icon: 'fact_check',
    },
  ];

  ngOnInit() {
    this.greeting = this.computeGreeting(this.today.getHours());
    this.state$ = toLoadState(this.tenderRepo.list());
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
        routerLink: AppRoutes.tenders(),
      },
      {
        label: 'Being evaluated',
        help: 'AI is checking submitted bidder documents',
        count: bucketCount('being-evaluated'),
        icon: 'autorenew',
        routerLink: AppRoutes.tenders(),
      },
      {
        label: 'Ready for your review',
        help: 'Evaluation is done, needs your decision',
        count: bucketCount('ready-for-review'),
        icon: 'rate_review',
        routerLink: AppRoutes.tenders(),
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
        route:
          d.actionRoute === 'upload'
            ? AppRoutes.upload()
            : AppRoutes.tenderBidders(t.id),
        tone: d.tone,
      };
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
