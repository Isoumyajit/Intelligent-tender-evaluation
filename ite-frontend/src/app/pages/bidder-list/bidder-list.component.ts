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
import { Observable, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
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
import { TenderStageStore } from '../../core/services/tender-stage.store';
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
    MatSnackBarModule,
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
  isClosed = false;
  hasEvaluation = false;
  auditLogs: any[] = [];
  auditExpanded = false;
  private isUploadSetupRoute = false;
  showAuditTrail = false;
  readonly routes = AppRoutes;

  ngOnInit() {
    const tenderId = this.route.snapshot.paramMap.get('tenderId')!;
    this.isUploadSetupRoute = this.router.url.startsWith('/upload/');
    this.showAuditTrail = !this.isUploadSetupRoute;

    const combined$ = forkJoin({
      tender: this.tenderRepo.getById(tenderId),
      bidders: this.bidderRepo.listForTender(tenderId),
    }).pipe(map((data) => data as BidderListData));

    this.state$ = toLoadState(combined$);
    this.state$.subscribe((s) => {
      if (s.status === 'success') {
        this.tender = s.data.tender ?? null;
        this.bidders = [...s.data.bidders].sort(
          (a, b) => b.confidenceScore - a.confidenceScore,
        );
        this.hasEvaluation = this.bidders.some((b) => b.confidenceScore > 0);
        if (this.tender) {
          this.isClosed = this.stages.get(this.tender.id) === 'closed';
        }
        this.crumbs = this.isUploadSetupRoute
          ? [
              { label: 'Upload', link: AppRoutes.upload() },
              { label: s.data.tender?.name ?? tenderId },
            ]
          : [
              { label: 'Tender List', link: AppRoutes.tenders() },
              { label: s.data.tender?.name ?? tenderId },
            ];
        if (this.showAuditTrail) {
          this.loadAudit(tenderId);
        }
      }
    });
  }

  private loadAudit(tenderId: string): void {
    this.http
      .get<any[]>(`${this.base}/audits/?tender_id=${tenderId}&sort-order=desc&count=100`)
      .subscribe((logs) => {
        this.auditLogs = logs;
      });
  }

  auditEventClass(event: string): string {
    if (event.includes('approved') || event.includes('completed')) return 'audit--success';
    if (event.includes('disqualified') || event.includes('closed')) return 'audit--warn';
    if (event.includes('failed') || event.includes('override')) return 'audit--action';
    return 'audit--info';
  }

  formatEvent(event: string): string {
    return event.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  exportAudit(): void {
    if (!this.tender || this.auditLogs.length === 0) return;
    const rows = ['Timestamp,Event,Description'];
    for (const log of this.auditLogs) {
      rows.push(
        `"${log.created_at}","${log.event}","${(log.audit_desc ?? '').replace(/"/g, "'")}"`,
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${this.tender.name.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  openAddBidder(): void {
    if (!this.tender) return;
    import('../uploads/bidder-form/bidder-form.component').then((m) => {
      const ref = this.dialog.open(m.BidderFormComponent, {
        width: '960px',
        maxWidth: '92vw',
        minHeight: '68vh',
        maxHeight: '92vh',
        panelClass: 'ite-bidder-dialog',
        data: { tenderId: this.tender!.id, tenderName: this.tender!.name },
      });
      ref.afterClosed().subscribe((result) => {
        if (!result) return;
        this.bidderRepo
          .addBidderToTender(this.tender!.id, {
            bidderName: result.bidderName ?? 'New bidder',
            uploadMode: result.uploadMode ?? 'folder',
            files: result.files ?? [],
          })
          .subscribe(() => {
            this.snack.open('Bidder added successfully.', 'Dismiss', {
              duration: 3000, horizontalPosition: 'end', verticalPosition: 'bottom',
            });
            const tenderId = this.tender!.id;
            this.bidderRepo.listForTender(tenderId).subscribe((bidders) => {
              this.bidders = [...bidders].sort((a, b) => b.confidenceScore - a.confidenceScore);
              this.hasEvaluation = this.bidders.some((b) => b.confidenceScore > 0);
            });
          });
      });
    });
  }

  openEvaluation(bidder: BidderSummary) {
    if (!this.hasEvaluation) return;
    this.router.navigate(
      this.isUploadSetupRoute
        ? AppRoutes.uploadBidderEvaluation(bidder.tenderId, bidder.id)
        : AppRoutes.bidderEvaluation(bidder.tenderId, bidder.id),
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
    return this.bidders.filter((b) => b.approvalStatus === 'approved').length;
  }

  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly stages = inject(TenderStageStore);
  private readonly base = environment.apiBaseUrl;

  exportAllBidders(): void {
    if (!this.tender || this.bidders.length === 0) return;

    const tenderId = this.tender.id;
    const calls = this.bidders.map((b) =>
      this.http
        .get<any>(
          `${this.base}/tenders/${encodeURIComponent(tenderId)}/bid/${encodeURIComponent(b.id)}/evaluation`,
        )
        .pipe(catchError(() => [null])),
    );

    forkJoin(calls).subscribe((evals) => {
      const rows: string[] = [];

      rows.push(`CONSOLIDATED EVALUATION REPORT — ${this.tender!.name}`);
      rows.push(`Generated: ${new Date().toLocaleString()}`);
      rows.push('');

      rows.push('SECTION 1: BIDDER SUMMARY');
      rows.push('Bidder Name,Overall Status,Confidence %,Technical,Financial,Compliance,Rank,Documents,Reason');

      for (const ev of evals) {
        if (!ev) continue;
        const criteria = ev.criteria ?? [];
        const failedNames = criteria
          .filter((c: any) => c.status === 'failed' || c.status === 'missing-document')
          .map((c: any) => c.title)
          .join('; ');
        const reason =
          ev.overallStatus === 'Qualified'
            ? 'All mandatory criteria satisfied'
            : ev.overallStatus === 'Under Review'
              ? 'Partial evidence — manual verification needed'
              : `Failed: ${failedNames || 'Multiple criteria not met'}`;
        rows.push(
          `"${ev.name}","${ev.overallStatus}",${ev.confidenceScore},${ev.technicalScore},${ev.financialScore},${ev.complianceScore},${ev.rank},${ev.documentsCount},"${reason}"`,
        );
      }

      rows.push('');
      rows.push('');
      rows.push('SECTION 2: DETAILED CRITERION-WISE EVALUATION');
      rows.push('Bidder Name,Category,Criterion,Status,Score,Requirement,Evidence,Notes');

      for (const ev of evals) {
        if (!ev) continue;
        for (const c of ev.criteria ?? []) {
          const status =
            c.status === 'passed' ? 'PASSED'
            : c.status === 'failed' ? 'FAILED'
            : c.status === 'missing-document' ? 'MISSING DOC'
            : 'REVIEW REQUIRED';
          const excerpt = (c.evidence?.[0]?.excerpt ?? '').replace(/"/g, "'").replace(/\n/g, ' ');
          rows.push(
            `"${ev.name}","${c.category}","${c.title}","${status}",${c.score},"${c.requirement.replace(/"/g, "'")}","${excerpt}","${(c.notes ?? '').replace(/"/g, "'")}"`,
          );
        }
      }

      this.downloadCsv(
        rows.join('\n'),
        `evaluation-all-bidders-${this.tender!.name.replace(/\s+/g, '-')}.csv`,
      );
    });
  }

  approveBidder(bidder: BidderSummary, event: Event): void {
    event.stopPropagation();
    if (this.isClosed) return;
    const isLow = bidder.confidenceScore < 60;
    import('../../shared/confirm-dialog/confirm-dialog.component').then((m) => {
      this.dialog
        .open(m.ConfirmDialogComponent, {
          width: '480px',
          data: {
            title: 'Approve bidder',
            message: isLow
              ? `"${bidder.name}" has only ${bidder.confidenceScore}% AI confidence. Approving a low-confidence bidder may require additional manual verification. Do you want to proceed?`
              : `Approve "${bidder.name}" as the selected bidder for this tender? This will mark the bidder as Qualified.`,
            icon: isLow ? 'warning' : 'verified',
            warn: isLow,
            confirmLabel: 'Approve',
          },
        })
        .afterClosed()
        .subscribe((result) => {
          if (!result?.confirmed) return;
          this.http
            .put(`${this.base}/tenders/${this.tender!.id}/bid/${bidder.id}/approval`, {
              action: 'approve', reason: '',
            })
            .subscribe(() => {
              bidder.overallStatus = 'Qualified';
              this.snack.open(`"${bidder.name}" has been approved.`, 'Dismiss', {
                duration: 4000, horizontalPosition: 'end', verticalPosition: 'bottom',
              });
              this.refreshBidders();
            });
        });
    });
  }

  disqualifyBidder(bidder: BidderSummary, event: Event): void {
    event.stopPropagation();
    if (this.isClosed) return;
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
            .put(`${this.base}/tenders/${this.tender!.id}/bid/${bidder.id}/approval`, {
              action: 'disqualify', reason: result.reason || '',
            })
            .subscribe(() => {
              bidder.overallStatus = 'Disqualified';
              this.snack.open(
                `"${bidder.name}" has been disqualified.${result.reason ? ' Reason: ' + result.reason : ''}`,
                'Dismiss',
                { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' },
              );
              this.refreshBidders();
            });
        });
    });
  }

  private refreshBidders(): void {
    if (!this.tender) return;
    this.bidderRepo.listForTender(this.tender.id).subscribe((bidders) => {
      this.bidders = [...bidders].sort((a, b) => b.confidenceScore - a.confidenceScore);
      this.hasEvaluation = this.bidders.some((b) => b.confidenceScore > 0);
    });
    this.loadAudit(this.tender.id);
  }

  closeTender(): void {
    if (!this.tender || this.isClosed) return;
    const qualifiedCount = this.bidders.filter(
      (b) => b.approvalStatus === 'approved',
    ).length;

    if (qualifiedCount === 0) {
      import('../../shared/confirm-dialog/confirm-dialog.component').then((m) => {
        this.dialog
          .open(m.ConfirmDialogComponent, {
            width: '480px',
            data: {
              title: 'Cannot close tender',
              message: `No bidders are currently approved. Please approve at least one bidder before closing the tender, or disqualify all bidders explicitly.`,
              icon: 'warning',
              warn: true,
              confirmLabel: 'OK',
              cancelLabel: 'Dismiss',
            },
          });
      });
      return;
    }

    import('../../shared/confirm-dialog/confirm-dialog.component').then((m) => {
      this.dialog
        .open(m.ConfirmDialogComponent, {
          width: '480px',
          data: {
            title: 'Close tender & sign off',
            message: `Close tender "${this.tender!.name}" with ${qualifiedCount} approved bidder(s)?\n\nOnce closed, no further changes can be made to bidder approvals or evaluations. This action will be logged in the audit trail.`,
            icon: 'lock',
            confirmLabel: 'Close & sign off',
          },
        })
        .afterClosed()
        .subscribe((result) => {
          if (!result?.confirmed) return;
          this.stages.set(this.tender!.id, 'closed');
          this.isClosed = true;
          const approved = this.bidders
            .filter((b) => b.overallStatus === 'Qualified')
            .map((b) => b.name)
            .join(', ');
          this.logAudit(
            'tender_closed',
            `Tender closed and signed off by officer. Approved bidders: ${approved}`,
          );
          this.snack.open(
            `Tender "${this.tender!.name}" has been closed and signed off.`,
            'Dismiss',
            { duration: 5000, horizontalPosition: 'end', verticalPosition: 'bottom' },
          );
        });
    });
  }

  private logAudit(event: string, desc: string, bidderId?: string): void {
    if (!this.tender) return;
    this.http
      .post(`${this.base}/audits/`, {
        tender_id: this.tender.id,
        bidder_id: bidderId ?? null,
        event,
        audit_desc: desc,
      })
      .subscribe();
  }

  private downloadCsv(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
