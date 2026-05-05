import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Observable, map, merge, of, shareReplay, startWith, switchMap } from 'rxjs';
import { TENDER_REPOSITORY } from '../../core/abstractions/tender-repository';
import { isInProgress } from '../../core/registry/tender-status.registry';
import { RefreshBus } from '../../core/services/refresh-bus';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
  private readonly tenderRepo = inject(TENDER_REPOSITORY);
  private readonly refresh = inject(RefreshBus);

  inProgressCount$: Observable<number> = of(0);

  ngOnInit(): void {
    this.inProgressCount$ = merge(of(null), this.refresh.tenders$).pipe(
      switchMap(() => this.tenderRepo.list()),
      map((tenders) => tenders.filter((t) => isInProgress(t.status)).length),
      startWith(0),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
