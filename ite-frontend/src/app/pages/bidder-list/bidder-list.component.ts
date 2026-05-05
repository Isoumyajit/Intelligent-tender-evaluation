import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { BIDDER_REPOSITORY } from '../../core/abstractions/bidder-repository';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import { EvaluationScorer } from '../../core/evaluation/evaluation-scorer';
import { LoadState, toLoadState } from '../../core/models/load-state';
import {
  BidderOverallStatus,
  BidderSummary,
  ProcessedTender,
} from '../../core/models/evaluation.models';
import { AppRoutes } from '../../core/routing/app-routes';
import {
  BreadcrumbComponent,
  BreadcrumbSegment,
} from '../../shared/breadcrumb/breadcrumb.component';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';

interface BidderListData {
  tender: ProcessedTender | undefined;
  bidders: BidderSummary[];
}

@Component({
  selector: 'app-bidder-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressBarModule,
    BreadcrumbComponent,
    LoadingPanelComponent,
  ],
  templateUrl: './bidder-list.component.html',
  styleUrl: './bidder-list.component.scss',
})
export class BidderListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly scorer = inject(EvaluationScorer);

  tender: ProcessedTender | null = null;
  bidders: BidderSummary[] = [];
  crumbs: BreadcrumbSegment[] = [];
  state$!: Observable<LoadState<BidderListData>>;
  readonly routes = AppRoutes;

  ngOnInit() {
    const tenderId = this.route.snapshot.paramMap.get('tenderId')!;

    const combined$ = forkJoin({
      tender: this.tenderRepo.getById(tenderId),
      bidders: this.bidderRepo.listForTender(tenderId),
    }).pipe(map((data) => data as BidderListData));

    this.state$ = toLoadState(combined$);
    this.state$.subscribe((s) => {
      if (s.status === 'success') {
        this.tender = s.data.tender ?? null;
        this.bidders = s.data.bidders;
        this.crumbs = [
          { label: 'Tender List', link: AppRoutes.tenders() },
          { label: s.data.tender?.name ?? tenderId },
        ];
      }
    });
  }

  openEvaluation(bidder: BidderSummary) {
    this.router.navigate(
      AppRoutes.bidderEvaluation(bidder.tenderId, bidder.id),
    );
  }

  confidenceTier(score: number): 'high' | 'medium' | 'low' {
    return this.scorer.tier(score);
  }

  confidenceLabel(score: number): string {
    const tier = this.confidenceTier(score);
    if (tier === 'high') return 'High confidence';
    if (tier === 'medium') return 'Moderate confidence';
    return 'Low confidence';
  }

  confidenceStatusClass(score: number): string {
    const tier = this.confidenceTier(score);
    if (tier === 'high') return 'ite-status--pass';
    if (tier === 'medium') return 'ite-status--partial';
    return 'ite-status--fail';
  }

  statusClassFor(overall: BidderOverallStatus): string {
    if (overall === 'Qualified') return 'ite-status--pass';
    if (overall === 'Disqualified') return 'ite-status--fail';
    return 'ite-status--partial';
  }

  get averageConfidence(): number {
    if (this.bidders.length === 0) return 0;
    return Math.round(
      this.bidders.reduce((s, b) => s + b.confidenceScore, 0) /
        this.bidders.length,
    );
  }

  get qualifiedCount(): number {
    return this.bidders.filter((b) => b.overallStatus === 'Qualified').length;
  }
}
