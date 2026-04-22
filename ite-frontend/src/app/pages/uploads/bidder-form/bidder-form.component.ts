import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';

interface BidderFile {
  id: string;
  bidderName: string;
  fileCount: number;
  totalSize: string;
}

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
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './bidder-form.component.html',
  styleUrl: './bidder-form.component.scss',
})
export class BidderFormComponent {
  form: FormGroup;
  uploadMode: 'folder' | 'zip' = 'folder';
  bidderFolders: BidderFile[] = [];
  zipFile: File | null = null;
  uploadError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<BidderFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BidderDialogData,
  ) {
    this.form = this.fb.group({
      bidderName: ['', Validators.required],
    });
  }

  setUploadMode(mode: 'folder' | 'zip') {
    this.uploadMode = mode;
    this.uploadError = null;
  }

  resetUploads() {
    this.bidderFolders = [];
    this.zipFile = null;
    this.uploadError = null;
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

    this.uploadError = null;

    const folderName = (
      files[0] as File & { webkitRelativePath?: string }
    ).webkitRelativePath?.split('/')[0];

    const totalBytes = Array.from(files).reduce(
      (sum, file) => sum + file.size,
      0,
    );

    this.bidderFolders.push({
      id: `BID-${Date.now()}-${this.bidderFolders.length}`,
      bidderName: folderName || `Bidder ${this.bidderFolders.length + 1}`,
      fileCount: files.length,
      totalSize: this.formatFileSize(totalBytes),
    });

    input.value = '';
  }

  removeFolder(folderId: string) {
    this.bidderFolders = this.bidderFolders.filter(
      (folder) => folder.id !== folderId,
    );
  }

  onZipSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const isZip = /\.zip$/i.test(file.name);
    if (!isZip) {
      this.uploadError = 'Please select a valid .zip file.';
      this.zipFile = null;
      input.value = '';
      return;
    }

    this.uploadError = null;
    this.zipFile = file;
    input.value = '';
  }

  clearZip() {
    this.zipFile = null;
  }

  canProceedToReview() {
    return this.uploadMode === 'folder'
      ? this.bidderFolders.length > 0
      : !!this.zipFile;
  }

  submit() {
    if (!this.form.valid || !this.canProceedToReview()) {
      return;
    }

    this.dialogRef.close({
      tenderId: this.data.tenderId,
      bidderName: this.form.value.bidderName,
      uploadMode: this.uploadMode,
      folders: this.bidderFolders,
      zipFileName: this.zipFile?.name ?? null,
    });
  }

  close() {
    this.dialogRef.close();
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1048576) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }
}
