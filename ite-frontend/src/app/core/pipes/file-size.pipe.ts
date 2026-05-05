import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a byte count as a human-readable file size.
 * Usage: {{ bytes | fileSize }} or {{ bytes | fileSize:2 }}
 */
@Pipe({ name: 'fileSize', standalone: true })
export class FileSizePipe implements PipeTransform {
  transform(
    bytes: number | null | undefined,
    decimals: number = 1,
  ): string {
    if (bytes == null || isNaN(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(decimals)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(
      decimals + 1,
    )} GB`;
  }
}

/**
 * Same formatting as the pipe, exposed as a utility for non-template
 * callers (services, .ts helpers).
 */
export function formatFileSize(bytes: number, decimals: number = 1): string {
  return new FileSizePipe().transform(bytes, decimals);
}
