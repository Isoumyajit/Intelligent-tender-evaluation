import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BidderFormComponent } from '../bidder-form/bidder-form.component';

interface UploadedTender {
  id: string;
  name: string;
  fileName: string;
  uploadedDate: string;
  fileSize: string;
  biddersCount: number;
  isExpanded: boolean;
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
  ],
  templateUrl: './ite-tender-form.component.html',
  styleUrl: './ite-tender-form.component.scss',
})
export class IteTenderFormComponent implements OnInit {
  form!: FormGroup;
  uploadedFile: File | null = null;
  isDragOver = false;
  uploadedTenders: UploadedTender[] = [
    {
      id: 'TEND-001',
      name: 'Highway Maintenance Contract',
      fileName: 'highway_maintenance_2026.pdf',
      uploadedDate: '2026-04-20',
      fileSize: '2.3 MB',
      biddersCount: 5,
      isExpanded: false,
    },
    {
      id: 'TEND-002',
      name: 'IT Infrastructure Upgrade',
      fileName: 'it_infra_upgrade.docx',
      uploadedDate: '2026-04-19',
      fileSize: '1.8 MB',
      biddersCount: 3,
      isExpanded: false,
    },
  ];

  constructor(
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) {}

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
    if (input.files?.length) {
      this.setFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file && this.isValidFileType(file)) {
      this.setFile(file);
    }
  }

  private extractFileNameWithoutExtension(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, '');
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

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1048576) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  onUploadTender() {
    if (this.form.valid && this.uploadedFile) {
      const newTender: UploadedTender = {
        id: `TEND-${Date.now()}`,
        name: this.form.get('tenderName')?.value,
        fileName: this.uploadedFile.name,
        uploadedDate: new Date().toISOString().split('T')[0],
        fileSize: this.formatFileSize(this.uploadedFile.size),
        biddersCount: 0,
        isExpanded: false,
      };

      this.uploadedTenders.unshift(newTender);
      this.form.reset();
      this.uploadedFile = null;
    }
  }

  toggleTenderExpansion(tenderId: string) {
    const tender = this.uploadedTenders.find((t) => t.id === tenderId);
    if (tender) {
      tender.isExpanded = !tender.isExpanded;
    }
  }

  openBidderDialog(tenderId: string) {
    const tender = this.uploadedTenders.find((t) => t.id === tenderId);
    if (!tender) {
      return;
    }

    const dialogRef = this.dialog.open(BidderFormComponent, {
      minWidth: '760px',
      minHeight: '60vh',
      data: {
        tenderId: tender.id,
        tenderName: tender.name,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        tender.biddersCount += 1;
      }
    });
  }

  private setFile(file: File) {
    if (this.isValidFileType(file)) {
      this.uploadedFile = file;
      const fileNameWithoutExtension = this.extractFileNameWithoutExtension(
        file.name,
      );
      this.form.patchValue({
        uploadedFile: file,
        tenderName: fileNameWithoutExtension,
      });
      this.form.get('uploadedFile')?.updateValueAndValidity();
    }
  }

  private isValidFileType(file: File): boolean {
    return [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ].includes(file.type);
  }
}
