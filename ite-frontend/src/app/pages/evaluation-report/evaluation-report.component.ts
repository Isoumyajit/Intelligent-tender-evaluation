import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
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
import { TenderStageStore } from '../../core/services/tender-stage.store';
import {
  BreadcrumbComponent,
  BreadcrumbSegment,
} from '../../shared/breadcrumb/breadcrumb.component';
import { EvidencePanelComponent } from '../../shared/evidence-panel/evidence-panel.component';
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
    MatProgressBarModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTooltipModule,
    BreadcrumbComponent,
    EvidencePanelComponent,
    LoadingPanelComponent,
  ],
  templateUrl: './evaluation-report.component.html',
  styleUrl: './evaluation-report.component.scss',
})
export class EvaluationReportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly scorer = inject(EvaluationScorer);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly stages = inject(TenderStageStore);
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  isClosed = false;

  tender: ProcessedTender | null = null;
  bidder: BidderEvaluation | null = null;
  crumbs: BreadcrumbSegment[] = [];
  categoryGroups: CategoryGroup[] = [];
  state$!: Observable<LoadState<EvaluationReportData>>;
  selectedCriterion: EvaluationCriterion | null = null;
  readonly routes = AppRoutes;

  openEvidence(criterion: EvaluationCriterion): void {
    this.selectedCriterion = criterion;
  }

  closeEvidence(): void {
    this.selectedCriterion = null;
  }

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
      if (tender) {
        this.isClosed = this.stages.get(tender.id) === 'closed';
      }

      if (tender && bidder) {
        this.crumbs = [
          { label: 'Tender List', link: AppRoutes.tenders() },
          { label: tender.name, link: AppRoutes.tenderBidders(tender.id) },
          {
            label: bidder.name,
            link: AppRoutes.bidderDocuments(tender.id, bidder.id),
          },
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
    if (status === 'missing-document') return 'file_present';
    return 'error';
  }

  statusLabel(status: CriterionStatus): string {
    if (status === 'passed') return 'PASSED';
    if (status === 'failed') return 'FAILED';
    if (status === 'missing-document') return 'MISSING DOC';
    return 'REVIEW REQUIRED';
  }

  statusClass(status: CriterionStatus): string {
    if (status === 'passed') return 'ite-status--pass';
    if (status === 'failed') return 'ite-status--fail';
    if (status === 'missing-document') return 'ite-status--fail';
    return 'ite-status--partial';
  }

  get passedCount(): number {
    return this.bidder?.criteria.filter((c) => c.status === 'passed').length ?? 0;
  }

  get failedCount(): number {
    return this.bidder?.criteria.filter((c) => c.status === 'failed' || c.status === 'missing-document').length ?? 0;
  }

  get partialCount(): number {
    return this.bidder?.criteria.filter((c) => c.status === 'partial').length ?? 0;
  }

  get missingDocCount(): number {
    return this.bidder?.criteria.filter((c) => c.status === 'missing-document').length ?? 0;
  }

  get overallScore(): number {
    if (!this.bidder || this.bidder.criteria.length === 0) return 0;
    const avg = this.bidder.criteria.reduce((s, c) => s + c.score, 0) / this.bidder.criteria.length;
    return Math.min(100, Math.round(avg));
  }

  get overallScoreClass(): string {
    const tier = this.scorer.tier(this.overallScore);
    if (tier === 'high') return 'ite-status--pass';
    if (tier === 'medium') return 'ite-status--partial';
    return 'ite-status--fail';
  }

  overrideCriterion(criterion: EvaluationCriterion, event: Event): void {
    event.stopPropagation();
    if (!this.tender || !this.bidder) return;
    const tenderId = this.tender.id;
    const bidderId = this.bidder.id;
    const conditionName = criterion.title.toLowerCase().replace(/\s+/g, '-');

    import('../../shared/confirm-dialog/confirm-dialog.component').then((m) => {
      this.dialog
        .open(m.ConfirmDialogComponent, {
          width: '480px',
          data: {
            title: `Override: ${criterion.title}`,
            message: `Current status: ${this.statusLabel(criterion.status)}.\n\nMark this criterion as PASSED? This will override the automated evaluation. The change will be logged in the audit trail.`,
            icon: 'edit_note',
            confirmLabel: 'Mark as Passed',
            showReasonField: true,
            reasonLabel: 'Reason for override',
          },
        })
        .afterClosed()
        .subscribe((result) => {
          if (!result?.confirmed) return;
          this.http
            .put(
              `${this.base}/tenders/${tenderId}/bid/${bidderId}/evaluation/${encodeURIComponent(conditionName)}`,
              { status: 'passed', notes: result.reason || 'Officer manual override' },
            )
            .subscribe({
              next: () => {
                criterion.status = 'passed';
                criterion.score = 100;
                criterion.notes = `Officer override: ${result.reason || 'Manual decision'}`;
                this.categoryGroups = this.groupByCategory(this.bidder!.criteria);
                this.snack.open(
                  `"${criterion.title}" marked as PASSED.`,
                  'Dismiss',
                  { duration: 4000, horizontalPosition: 'end', verticalPosition: 'bottom' },
                );
              },
              error: () => {
                this.snack.open('Failed to save override. Please try again.', 'Dismiss', {
                  duration: 4000, horizontalPosition: 'end', verticalPosition: 'bottom',
                });
              },
            });
        });
    });
  }

  approveBidder(): void {
    if (!this.bidder || !this.tender) return;
    const isLow = this.bidder.confidenceScore < 60;
    const bidder = this.bidder;
    const tenderId = this.tender.id;

    import('../../shared/confirm-dialog/confirm-dialog.component').then((m) => {
      this.dialog
        .open(m.ConfirmDialogComponent, {
          width: '480px',
          data: {
            title: 'Approve bidder',
            message: isLow
              ? `"${bidder.name}" has only ${bidder.confidenceScore}% AI confidence. Approving a low-confidence bidder may require additional manual verification. Do you want to proceed?`
              : `Approve "${bidder.name}" as the selected bidder? This will mark the bidder as Qualified.`,
            icon: isLow ? 'warning' : 'verified',
            warn: isLow,
            confirmLabel: 'Approve',
          },
        })
        .afterClosed()
        .subscribe((result) => {
          if (!result?.confirmed) return;
          this.http
            .put(`${this.base}/tenders/${tenderId}/bid/${bidder.id}/approval`, {
              action: 'approve', reason: '',
            })
            .subscribe(() => {
              bidder.approvalStatus = 'approved';
              bidder.overallStatus = 'Qualified';
              this.snack.open(`"${bidder.name}" has been approved.`, 'Dismiss', {
                duration: 4000, horizontalPosition: 'end', verticalPosition: 'bottom',
              });
            });
        });
    });
  }

  disqualifyBidder(): void {
    if (!this.bidder || !this.tender) return;
    const bidder = this.bidder;
    const tenderId = this.tender.id;

    import('../../shared/confirm-dialog/confirm-dialog.component').then((m) => {
      this.dialog
        .open(m.ConfirmDialogComponent, {
          width: '480px',
          data: {
            title: 'Disqualify bidder',
            message: `Are you sure you want to disqualify "${bidder.name}"? This bidder will be marked as Disqualified in the evaluation report.`,
            icon: 'block',
            warn: true,
            confirmLabel: 'Disqualify',
            showReasonField: true,
            reasonLabel: 'Reason for disqualification (optional)',
          },
        })
        .afterClosed()
        .subscribe((result) => {
          if (!result?.confirmed) return;
          this.http
            .put(`${this.base}/tenders/${tenderId}/bid/${bidder.id}/approval`, {
              action: 'disqualify', reason: result.reason || '',
            })
            .subscribe(() => {
              bidder.approvalStatus = 'disqualified';
              bidder.overallStatus = 'Disqualified';
              this.snack.open(
                `"${bidder.name}" has been disqualified.${result.reason ? ' Reason: ' + result.reason : ''}`,
                'Dismiss',
                { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' },
              );
            });
        });
    });
  }

  exportReport(): void {
    if (!this.tender || !this.bidder) return;

    const rows: string[] = [];
    rows.push(
      'Tender,Bidder,Overall Status,Confidence %,Category,Criterion,Status,Score,Requirement,Evidence Excerpt,Notes',
    );

    for (const c of this.bidder.criteria) {
      const excerpt = c.evidence.length > 0
        ? c.evidence[0].excerpt.replace(/"/g, "'").replace(/\n/g, ' ')
        : '';
      rows.push(
        `"${this.tender.name}","${this.bidder.name}","${this.bidder.overallStatus}",${this.bidder.confidenceScore},"${c.category}","${c.title}","${this.statusLabel(c.status)}",${c.score},"${c.requirement.replace(/"/g, "'")}","${excerpt}","${(c.notes ?? '').replace(/"/g, "'")}"`,
      );
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-${this.bidder.name.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
