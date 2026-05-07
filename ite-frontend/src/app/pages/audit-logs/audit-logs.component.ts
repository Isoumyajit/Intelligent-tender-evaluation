import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../../environments/environment';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import { ProcessedTender } from '../../core/models/evaluation.models';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';

interface AuditLog {
  audit_id: string;
  tender_id: string;
  bidder_id: string | null;
  event: string;
  audit_desc: string;
  created_at: string;
}

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    BreadcrumbComponent,
  ],
  template: `
    <main class="ite-audit-logs">
      <app-breadcrumb [segments]="[{ label: 'Audit Logs' }]"></app-breadcrumb>

      <header class="header">
        <div>
          <p class="eyebrow">Compliance</p>
          <h1>Audit Logs</h1>
          <p class="subline">Complete trail of every automated and manual action across all tenders.</p>
        </div>
        <div class="header__actions">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Filter by tender</mat-label>
            <mat-select [(value)]="selectedTenderId" (selectionChange)="loadLogs()">
              <mat-option value="all">All tenders</mat-option>
              @for (t of tenders; track t.id) {
                <mat-option [value]="t.id">{{ t.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (logs.length > 0) {
            <button mat-flat-button color="primary" (click)="exportCsv()">
              <mat-icon>download</mat-icon>
              Export CSV
            </button>
          }
        </div>
      </header>

      @if (logs.length === 0) {
        <div class="empty">
          <mat-icon>history</mat-icon>
          <p>No audit events recorded yet.</p>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Tender</th>
                <th>Event</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              @for (log of logs; track log.audit_id) {
                <tr>
                  <td class="ts">{{ log.created_at | date:'medium' }}</td>
                  <td class="tender-name">{{ tenderName(log.tender_id) }}</td>
                  <td>
                    <mat-chip class="event-chip {{ eventTone(log.event) }}" disableRipple>
                      {{ log.event }}
                    </mat-chip>
                  </td>
                  <td>{{ log.audit_desc }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="count">{{ logs.length }} events</p>
      }
    </main>
  `,
  styles: [`
    .ite-audit-logs {
      padding: clamp(16px, 2.5vw, 32px) 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ite-primary);
      margin: 0 0 8px;
    }
    h1 { margin: 0 0 4px; }
    .subline { margin: 0; color: var(--ite-text-secondary); }
    .header__actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .empty {
      text-align: center;
      padding: 48px 16px;
      color: var(--ite-text-secondary);
      mat-icon { font-size: 3rem; width: 3rem; height: 3rem; opacity: 0.4; }
    }
    .table-wrap {
      overflow-x: auto;
      max-height: 600px;
      overflow-y: auto;
      border: 1px solid var(--ite-border);
      border-radius: 8px;
    }
    .audit-table thead th {
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
      th {
        text-align: left;
        padding: 10px 14px;
        background: var(--mat-sys-surface-container-low, #f6f6fa);
        font-weight: 600;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ite-text-secondary);
        border-bottom: 1px solid var(--ite-border);
      }
      td {
        padding: 10px 14px;
        border-bottom: 1px solid var(--ite-border);
        vertical-align: top;
      }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: color-mix(in srgb, var(--ite-primary) 3%, transparent); }
    }
    .ts { white-space: nowrap; font-size: 0.82rem; color: var(--ite-text-secondary); }
    .tender-name { font-weight: 500; white-space: nowrap; }
    .event-chip { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.03em; }
    .ite-status--pass { }
    .ite-status--neutral { }
    .count { margin-top: 12px; font-size: 0.82rem; color: var(--ite-text-secondary); }
  `],
})
export class AuditLogsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly base = environment.apiBaseUrl;

  tenders: ProcessedTender[] = [];
  logs: AuditLog[] = [];
  selectedTenderId = 'all';
  private tenderMap = new Map<string, string>();

  ngOnInit(): void {
    this.tenderRepo.list().subscribe((t) => {
      this.tenders = t;
      this.tenderMap = new Map(t.map((x) => [x.id, x.name]));
    });
    this.loadLogs();
  }

  loadLogs(): void {
    const params =
      this.selectedTenderId === 'all'
        ? 'sort-order=desc&count=200'
        : `tender_id=${this.selectedTenderId}&sort-order=desc&count=200`;
    this.http
      .get<AuditLog[]>(`${this.base}/audits/?${params}`)
      .subscribe((logs) => (this.logs = logs));
  }

  tenderName(id: string): string {
    return this.tenderMap.get(id) ?? id.substring(0, 8);
  }

  eventTone(event: string): string {
    if (event.includes('approved') || event.includes('completed')) return 'ite-status--pass';
    if (event.includes('disqualified') || event.includes('failed') || event.includes('closed')) return 'ite-status--fail';
    return 'ite-status--neutral';
  }

  exportCsv(): void {
    const rows = ['Timestamp,Tender,Event,Description'];
    for (const log of this.logs) {
      rows.push(
        `"${log.created_at}","${this.tenderName(log.tender_id)}","${log.event}","${(log.audit_desc ?? '').replace(/"/g, "'")}"`,
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${this.selectedTenderId === 'all' ? 'all' : this.tenderName(this.selectedTenderId)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
