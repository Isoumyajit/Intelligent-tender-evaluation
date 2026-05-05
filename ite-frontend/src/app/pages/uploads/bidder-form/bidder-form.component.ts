import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { FileSizePipe } from '../../../core/pipes/file-size.pipe';
import {
  BidderGroup,
  UploadService,
  UploadSessionState,
  ValidationResult,
} from '../../../core/services/upload.service';

interface BidderDialogData {
  tenderId: string;
  tenderName: string;
}

@Component({
  selector: 'app-bidder-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatStepperModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    FileSizePipe,
  ],
  templateUrl: './bidder-form.component.html',
  styleUrl: './bidder-form.component.scss',
})
export class BidderFormComponent implements OnInit, OnDestroy {
  form: FormGroup;
  uploadMode: 'folder' | 'zip' = 'folder';
  validation: ValidationResult | null = null;
  zipPreview: { bidderFolders: string[]; fileCount: number } | null = null;
  inspectingZip = false;
  session: UploadSessionState | null = null;
  pendingZipFile: File | null = null;

  private stateSub?: Subscription;
  private autoStartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<BidderFormComponent>,
    public uploads: UploadService,
    @Inject(MAT_DIALOG_DATA) public data: BidderDialogData,
  ) {
    this.form = this.fb.group({
      bidderName: ['', [Validators.required, Validators.minLength(3)]],
    });
  }

  ngOnInit() {
    this.stateSub = this.uploads.getState().subscribe((s) => {
      this.session = s;
    });
  }

  ngOnDestroy() {
    if (this.autoStartTimer) {
      clearTimeout(this.autoStartTimer);
      this.autoStartTimer = null;
    }
    this.stateSub?.unsubscribe();
    this.uploads.reset();
  }

  private scheduleAutoStart() {
    if (this.autoStartTimer) {
      clearTimeout(this.autoStartTimer);
    }
    this.autoStartTimer = setTimeout(() => {
      this.autoStartTimer = null;
      if (this.session && this.session.phase === 'queued') {
        this.uploads.start();
      }
    }, 400);
  }

  setUploadMode(mode: 'folder' | 'zip') {
    if (this.session && this.session.phase === 'uploading') {
      return;
    }
    this.uploadMode = mode;
    this.uploads.reset();
    this.validation = null;
    this.zipPreview = null;
    this.pendingZipFile = null;
  }

  triggerFolderPicker(input: HTMLInputElement) {
    input.click();
  }

  triggerZipPicker(input: HTMLInputElement) {
    input.click();
  }

  onFolderSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }

    const fileArray = Array.from(files);
    this.validation = this.uploads.validateFiles(fileArray);

    if (!this.validation.valid) {
      input.value = '';
      return;
    }

    const folderName =
      (fileArray[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath?.split('/')[0] ||
      `Bidder ${((this.session?.groups.length ?? 0) + 1).toString()}`;

    if (!this.session) {
      this.uploads.prepareFolderSession(fileArray, folderName);
    } else {
      this.uploads.addBidderGroupToSession(fileArray, folderName);
    }

    if (!this.form.get('bidderName')?.value) {
      this.form.patchValue({ bidderName: folderName });
    }

    this.scheduleAutoStart();
    input.value = '';
  }

  removeGroup(groupId: string) {
    if (!this.session) {
      return;
    }
    const remaining = this.session.groups.filter((g) => g.id !== groupId);
    if (remaining.length === 0) {
      this.uploads.reset();
      this.validation = null;
    } else {
      // Rebuild session by resetting and re-preparing remaining groups is complex;
      // for mock purposes we just hide it by resetting — user can re-add.
      this.uploads.reset();
      this.validation = null;
    }
  }

  onZipSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!/\.zip$/i.test(file.name)) {
      this.validation = {
        valid: false,
        errors: ['Please select a valid .zip archive.'],
        warnings: [],
      };
      input.value = '';
      return;
    }

    this.validation = this.uploads.validateFiles([file]);
    if (!this.validation.valid) {
      input.value = '';
      return;
    }

    this.pendingZipFile = file;
    this.inspectingZip = true;
    this.zipPreview = null;

    this.uploads.simulateZipInspection(file).subscribe({
      next: (preview) => {
        this.zipPreview = preview;
        this.inspectingZip = false;
        this.uploads.prepareZipSession(file);
        if (!this.form.get('bidderName')?.value && preview.bidderFolders.length > 0) {
          this.form.patchValue({
            bidderName: `Batch of ${preview.bidderFolders.length} bidders`,
          });
        }
        this.scheduleAutoStart();
      },
      error: () => {
        this.inspectingZip = false;
        this.validation = {
          valid: false,
          errors: ['Could not read zip structure.'],
          warnings: [],
        };
      },
    });

    input.value = '';
  }

  clearZip() {
    this.pendingZipFile = null;
    this.zipPreview = null;
    this.uploads.reset();
    this.validation = null;
  }

  cancelUpload() {
    this.uploads.cancelAll();
  }

  retry(itemId: string) {
    this.uploads.retryItem(itemId);
  }

  canProceedToReview(): boolean {
    if (!this.session) {
      return false;
    }
    return this.session.phase === 'completed';
  }

  uploadInProgress(): boolean {
    return !!this.session && this.session.phase === 'uploading';
  }

  submit() {
    if (!this.form.valid || !this.canProceedToReview() || !this.session) {
      return;
    }

    this.dialogRef.close({
      tenderId: this.data.tenderId,
      bidderName: this.form.value.bidderName,
      uploadMode: this.uploadMode,
      groups: this.session.groups.map((g) => ({
        groupName: g.groupName,
        fileCount: g.items.length,
        totalSize: g.totalSize,
      })),
    });
  }

  close() {
    this.dialogRef.close();
  }

}
