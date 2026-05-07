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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TENDER_REPOSITORY } from '../../../core/abstractions/tender-repository';
import { ProcessedTender } from '../../../core/models/evaluation.models';
import { FileSizePipe } from '../../../core/pipes/file-size.pipe';
import { AppRoutes } from '../../../core/routing/app-routes';

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
    MatSnackBarModule,
    FileSizePipe,
  ],
  templateUrl: './ite-tender-form.component.html',
  styleUrl: './ite-tender-form.component.scss',
})
export class IteTenderFormComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly tenderRepo = inject(TENDER_REPOSITORY);

  readonly routes = AppRoutes;

  form!: FormGroup;
  uploadedFile: File | null = null;
  isDragOver = false;
  lastUploaded: ProcessedTender | null = null;
  isUploading = false;

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
    if (!this.form.valid || !this.uploadedFile || this.isUploading) return;

    const tenderName: string = this.form.get('tenderName')?.value;
    const file = this.uploadedFile;
    this.isUploading = true;

    this.tenderRepo.createWithDocument(tenderName, file).subscribe({
      next: (created) => {
        this.lastUploaded = created;
        this.form.reset();
        this.uploadedFile = null;
        this.isUploading = false;
        this.snackBar.open(
          `Tender "${created.name}" saved. Open tender view to add bidders.`,
          'Dismiss',
          { duration: 4000, horizontalPosition: 'end', verticalPosition: 'bottom' },
        );
      },
      error: () => {
        this.isUploading = false;
        this.snackBar.open(
          'Upload failed. Please try again.',
          'Dismiss',
          { duration: 4000, horizontalPosition: 'end', verticalPosition: 'bottom' },
        );
      },
    });
  }

  goToEvaluations(): void {
    this.router.navigate(AppRoutes.evaluations());
  }

  goToTenders(): void {
    this.router.navigate(AppRoutes.tenders());
  }

  goToUploadedTender(): void {
    if (!this.lastUploaded) return;
    this.router.navigate(AppRoutes.uploadTenderBidders(this.lastUploaded.id));
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
