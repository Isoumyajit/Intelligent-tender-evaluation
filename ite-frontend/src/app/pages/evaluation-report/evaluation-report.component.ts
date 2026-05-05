import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { BIDDER_REPOSITORY } from '../../core/abstractions/bidder-repository';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import { EvaluationScorer } from '../../core/evaluation/evaluation-scorer';
import { LoadState, toLoadState } from '../../core/models/load-state';
import {
  BidderEvaluation,
  CriterionCategory,
  CriterionStatus,
  EvaluationCriterion,
  ProcessedTender,
} from '../../core/models/evaluation.models';
import { AppRoutes } from '../../core/routing/app-routes';
import {
  BreadcrumbComponent,
  BreadcrumbSegment,
} from '../../shared/breadcrumb/breadcrumb.component';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';

interface CategoryGroup {
  category: CriterionCategory;
  criteria: EvaluationCriterion[];
  weightTotal: number;
  scoreTotal: number;
  passRate: number;
}

interface EvaluationReportData {
  tender: ProcessedTender | undefined;
  bidder: BidderEvaluation | undefined;
}

@Component({
  selector: 'app-evaluation-report',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatTabsModule,
    BreadcrumbComponent,
    LoadingPanelComponent,
  ],
  templateUrl: './evaluation-report.component.html',
  styleUrl: './evaluation-report.component.scss',
})
export class EvaluationReportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly scorer = inject(EvaluationScorer);

  tender: ProcessedTender | null = null;
  bidder: BidderEvaluation | null = null;
  crumbs: BreadcrumbSegment[] = [];
  categoryGroups: CategoryGroup[] = [];
  state$!: Observable<LoadState<EvaluationReportData>>;
  readonly routes = AppRoutes;

  ngOnInit() {
    const tenderId = this.route.snapshot.paramMap.get('tenderId')!;
    const bidderId = this.route.snapshot.paramMap.get('bidderId')!;

    const combined$ = forkJoin({
      tender: this.tenderRepo.getById(tenderId),
      bidder: this.bidderRepo.getEvaluation(tenderId, bidderId),
    }).pipe(map((d) => d as EvaluationReportData));

    this.state$ = toLoadState(combined$);
    this.state$.subscribe((s) => {
      if (s.status !== 'success') return;
      const { tender, bidder } = s.data;
      this.tender = tender ?? null;
      this.bidder = bidder ?? null;

      if (tender && bidder) {
        this.crumbs = [
          { label: 'Tender List', link: AppRoutes.tenders() },
          { label: tender.name, link: AppRoutes.tenderBidders(tender.id) },
          { label: bidder.name },
          { label: 'Evaluation Report' },
        ];
        this.categoryGroups = this.groupByCategory(bidder.criteria);
      }
    });
  }

  private groupByCategory(criteria: EvaluationCriterion[]): CategoryGroup[] {
    const order: CriterionCategory[] = [
      'Eligibility',
      'Technical',
      'Financial',
      'Compliance',
    ];

    return order
      .map((cat) => {
        const inCat = criteria.filter((c) => c.category === cat);
        if (inCat.length === 0) return null;
        const weightTotal = inCat.reduce((s, c) => s + c.weight, 0);
        const scoreTotal = inCat.reduce((s, c) => s + c.score, 0);
        const passCount = inCat.filter((c) => c.status === 'passed').length;
        const passRate = Math.round((passCount / inCat.length) * 100);
        return { category: cat, criteria: inCat, weightTotal, scoreTotal, passRate };
      })
      .filter((x): x is CategoryGroup => x !== null);
  }

  statusIcon(status: CriterionStatus): string {
    if (status === 'passed') return 'check_circle';
    if (status === 'failed') return 'cancel';
    return 'error';
  }

  statusLabel(status: CriterionStatus): string {
    if (status === 'passed') return 'PASSED';
    if (status === 'failed') return 'FAILED';
    return 'PARTIAL';
  }

  statusClass(status: CriterionStatus): string {
    if (status === 'passed') return 'ite-status--pass';
    if (status === 'failed') return 'ite-status--fail';
    return 'ite-status--partial';
  }

  get passedCount(): number {
    return this.bidder?.criteria.filter((c) => c.status === 'passed').length ?? 0;
  }

  get failedCount(): number {
    return this.bidder?.criteria.filter((c) => c.status === 'failed').length ?? 0;
  }

  get partialCount(): number {
    return this.bidder?.criteria.filter((c) => c.status === 'partial').length ?? 0;
  }

  get overallScore(): number {
    if (!this.bidder) return 0;
    const total = this.bidder.criteria.reduce((s, c) => s + c.score, 0);
    const weight = this.bidder.criteria.reduce((s, c) => s + c.weight, 0);
    return this.scorer.percent(total, weight);
  }

  get overallScoreClass(): string {
    const tier = this.scorer.tier(this.overallScore);
    if (tier === 'high') return 'ite-status--pass';
    if (tier === 'medium') return 'ite-status--partial';
    return 'ite-status--fail';
  }
}
