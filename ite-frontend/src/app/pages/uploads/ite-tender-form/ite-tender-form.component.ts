import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BIDDER_REPOSITORY } from '../../../core/abstractions/bidder-repository';
import {
  FileSizePipe,
  formatFileSize,
} from '../../../core/pipes/file-size.pipe';
import { AppRoutes } from '../../../core/routing/app-routes';
import { RefreshBus } from '../../../core/services/refresh-bus';
import { BidderFormComponent } from '../bidder-form/bidder-form.component';

/** Session-local snapshot of the tender the user just uploaded. The upload
 *  page no longer keeps a full list — processed/pending tenders live on the
 *  Evaluations page (for in-flight work) and Processed Tenders (for the
 *  archive). Only the most recent upload shows here, so the officer can
 *  add bidders in the same session without switching pages. */
interface SessionTender {
  /** Server-side id once the real backend returns one. Session-only for now. */
  id: string;
  name: string;
  fileName: string;
  fileSize: string;
  uploadedDate: string;
  biddersAdded: boolean;
}

@Component({
  selector: 'app-ite-tender-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatStepperModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    FileSizePipe,
  ],
  templateUrl: './ite-tender-form.component.html',
  styleUrl: './ite-tender-form.component.scss',
})
export class IteTenderFormComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly bidderRepo = inject(BIDDER_REPOSITORY);
  private readonly refresh = inject(RefreshBus);

  readonly routes = AppRoutes;

  form!: FormGroup;
  uploadedFile: File | null = null;
  isDragOver = false;
  lastUploaded: SessionTender | null = null;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.initializeForm();
  }

  initializeForm() {
    this.form = this.fb.group({
      tenderName: ['', Validators.required],
      uploadedFile: [null, Validators.required],
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.setFile(input.files[0]);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file && this.isValidFileType(file)) this.setFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave() {
    this.isDragOver = false;
  }

  removeFile() {
    this.uploadedFile = null;
    this.form.patchValue({ uploadedFile: null });
  }

  onUploadTender() {
    if (!this.form.valid || !this.uploadedFile) return;

    // TODO: once TenderRepository gains a create() method the upload will
    // go through it; for now we synthesize a session-local record so the
    // right-panel has something to show.
    this.lastUploaded = {
      id: `SESSION-${Date.now().toString(36)}`,
      name: this.form.get('tenderName')?.value,
      fileName: this.uploadedFile.name,
      fileSize: formatFileSize(this.uploadedFile.size),
      uploadedDate: new Date().toISOString().split('T')[0],
      biddersAdded: false,
    };

    this.form.reset();
    this.uploadedFile = null;
    this.snackBar.open(
      `Tender "${this.lastUploaded.name}" uploaded. Add bidders to start evaluation.`,
      'Dismiss',
      { duration: 4000, horizontalPosition: 'end', verticalPosition: 'bottom' },
    );
  }

  openBidderDialog(): void {
    if (!this.lastUploaded) return;
    const tender = this.lastUploaded;

    const ref = this.dialog.open(BidderFormComponent, {
      width: '960px',
      maxWidth: '92vw',
      minHeight: '68vh',
      maxHeight: '92vh',
      panelClass: 'ite-bidder-dialog',
      data: { tenderId: tender.id, tenderName: tender.name },
    });

    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.bidderRepo
        .addBidderToTender(tender.id, {
          bidderName: result.bidderName ?? 'New bidder',
          uploadMode: result.uploadMode ?? 'folder',
          fileCount: result.groups?.reduce(
            (s: number, g: { fileCount?: number }) => s + (g.fileCount ?? 0),
            0,
          ),
          totalSizeBytes: result.groups?.reduce(
            (s: number, g: { totalSize?: number }) => s + (g.totalSize ?? 0),
            0,
          ),
        })
        .subscribe(() => {
          if (this.lastUploaded && this.lastUploaded.id === tender.id) {
            this.lastUploaded = { ...this.lastUploaded, biddersAdded: true };
          }
        });
    });
  }

  goToEvaluations(): void {
    this.router.navigate(AppRoutes.evaluations());
  }

  goToTenders(): void {
    this.router.navigate(AppRoutes.tenders());
  }

  private setFile(file: File) {
    if (!this.isValidFileType(file)) return;
    this.uploadedFile = file;
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    this.form.patchValue({
      uploadedFile: file,
      tenderName: nameWithoutExt,
    });
    this.form.get('uploadedFile')?.updateValueAndValidity();
  }

  private isValidFileType(file: File): boolean {
    return [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ].includes(file.type);
  }
}
