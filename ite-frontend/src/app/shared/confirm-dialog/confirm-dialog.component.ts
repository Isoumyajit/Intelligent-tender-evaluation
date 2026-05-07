import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ConfirmDialogData {
  title: string;
  message: string;
  icon?: string;
  warn?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  showReasonField?: boolean;
  reasonLabel?: string;
}

export interface ConfirmDialogResult {
  confirmed: boolean;
  reason?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      @if (data.icon) {
        <mat-icon class="dialog-icon" [class.warn]="data.warn">{{ data.icon }}</mat-icon>
      }
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p class="dialog-message">{{ data.message }}</p>
      @if (data.showReasonField) {
        <mat-form-field appearance="outline" class="reason-field">
          <mat-label>{{ data.reasonLabel || 'Reason (optional)' }}</mat-label>
          <textarea matInput [(ngModel)]="reason" rows="2"></textarea>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="onCancel()">
        {{ data.cancelLabel || 'Cancel' }}
      </button>
      <button
        mat-flat-button
        [color]="data.warn ? 'warn' : 'primary'"
        (click)="onConfirm()"
      >
        {{ data.confirmLabel || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dialog-icon {
      color: var(--mat-sys-primary);
    }
    .dialog-icon.warn {
      color: var(--mat-sys-error);
    }
    .dialog-message {
      margin: 0 0 16px;
      line-height: 1.6;
      color: var(--mat-sys-on-surface-variant);
    }
    .reason-field {
      width: 100%;
    }
  `],
})
export class ConfirmDialogComponent {
  reason = '';

  constructor(
    private readonly dialogRef: MatDialogRef<ConfirmDialogComponent, ConfirmDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
  ) {}

  onCancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  onConfirm(): void {
    this.dialogRef.close({ confirmed: true, reason: this.reason || undefined });
  }
}
