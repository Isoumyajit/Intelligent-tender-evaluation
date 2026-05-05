import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import { LoadState, toLoadState } from '../../core/models/load-state';
import { ProcessedTender } from '../../core/models/evaluation.models';
import { describeStatus } from '../../core/registry/tender-status.registry';
import { AppRoutes } from '../../core/routing/app-routes';
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb.component';
import { LoadingPanelComponent } from '../../shared/loading-panel/loading-panel.component';

@Component({
  selector: 'app-tender-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    BreadcrumbComponent,
    LoadingPanelComponent,
  ],
  templateUrl: './tender-list.component.html',
  styleUrl: './tender-list.component.scss',
})
export class TenderListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);

  tenders: ProcessedTender[] = [];
  filter = '';
  state$!: Observable<LoadState<ProcessedTender[]>>;

  readonly crumbs = [{ label: 'Tender List' }];

  ngOnInit() {
    this.state$ = toLoadState(this.tenderRepo.list());
    this.state$.subscribe((s) => {
      if (s.status === 'success') this.tenders = s.data;
    });
  }

  get totalBidders(): number {
    return this.tenders.reduce((sum, t) => sum + t.biddersCount, 0);
  }

  get filtered(): ProcessedTender[] {
    if (!this.filter.trim()) return this.tenders;
    const q = this.filter.toLowerCase();
    return this.tenders.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.authority.toLowerCase().includes(q),
    );
  }

  openBidders(tender: ProcessedTender) {
    this.router.navigate(AppRoutes.tenderBidders(tender.id));
  }

  describe(status: ProcessedTender['status']) {
    return describeStatus(status);
  }
}
