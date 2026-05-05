import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoadState } from '../../core/models/load-state';

@Component({
  selector: 'app-loading-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './loading-panel.component.html',
  styleUrl: './loading-panel.component.scss',
})
export class LoadingPanelComponent<T> {
  @Input({ required: true }) state!: LoadState<T>;
  @Input() loadingLabel = 'Loading…';
  @Input() emptyLabel = 'Nothing to show yet.';

  get isLoading(): boolean {
    return this.state.status === 'loading';
  }
  get isError(): boolean {
    return this.state.status === 'error';
  }
  get errorMessage(): string | null {
    return this.state.status === 'error' ? this.state.error : null;
  }
}
