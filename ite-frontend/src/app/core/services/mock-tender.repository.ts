import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TenderRepository } from '../abstractions/tender-repository';
import { ProcessedTender } from '../models/evaluation.models';

@Injectable({ providedIn: 'root' })
export class MockTenderRepository implements TenderRepository {
  private readonly tenders: ProcessedTender[] = [
    {
      id: 'TEND-2026-041',
      reference: 'ITE/2026/041',
      name: 'Highway Maintenance Contract - NH44',
      authority: 'Public Works Division',
      uploadedDate: '2026-04-20',
      closingDate: '2026-05-30',
      status: 'Technical Evaluation',
      biddersCount: 5,
      documentName: 'highway_maintenance_2026.pdf',
      documentSize: '2.3 MB',
      estimatedValue: '₹ 48.5 Cr',
      description:
        'Annual maintenance contract for NH44 stretch covering 312 km including pothole repair, re-carpeting, and signage.',
    },
    {
      id: 'TEND-2026-037',
      reference: 'ITE/2026/037',
      name: 'Smart City IT Infrastructure Upgrade',
      authority: 'Smart City Mission',
      uploadedDate: '2026-04-19',
      closingDate: '2026-06-05',
      status: 'Financial Comparison',
      biddersCount: 4,
      documentName: 'it_infra_upgrade.docx',
      documentSize: '1.8 MB',
      estimatedValue: '₹ 22.0 Cr',
      description:
        'Upgrade of city-wide surveillance, Wi-Fi backbone, and data center refresh across 14 zones.',
    },
    {
      id: 'TEND-2026-029',
      reference: 'ITE/2026/029',
      name: 'Water Treatment Plant Expansion',
      authority: 'Rural Infrastructure Board',
      uploadedDate: '2026-04-18',
      closingDate: '2026-05-25',
      status: 'Award Recommended',
      biddersCount: 6,
      documentName: 'water_treatment_expansion.pdf',
      documentSize: '3.1 MB',
      estimatedValue: '₹ 76.2 Cr',
      description:
        'Capacity expansion from 40 MLD to 75 MLD including new clarifier, filter bed, and SCADA integration.',
    },
    {
      id: 'TEND-2026-022',
      reference: 'ITE/2026/022',
      name: 'Urban Solar Rooftop Programme',
      authority: 'Renewable Energy Agency',
      uploadedDate: '2026-04-10',
      closingDate: '2026-05-15',
      status: 'Pending Review',
      biddersCount: 3,
      documentName: 'solar_rooftop_2026.pdf',
      documentSize: '1.5 MB',
      estimatedValue: '₹ 12.8 Cr',
      description:
        'Installation of 8 MW of rooftop solar across government buildings under CAPEX model.',
    },
    {
      id: 'TEND-2026-018',
      reference: 'ITE/2026/018',
      name: 'Metro Station Civil Works - Phase III',
      authority: 'Metropolitan Transport Authority',
      uploadedDate: '2026-03-28',
      closingDate: '2026-05-10',
      status: 'Technical Evaluation',
      biddersCount: 7,
      documentName: 'metro_phase3_civil.pdf',
      documentSize: '4.2 MB',
      estimatedValue: '₹ 184.0 Cr',
      description:
        'Civil works for three underground stations including tunnel boring support and finishing.',
    },
  ];

  list(): Observable<ProcessedTender[]> {
    return of(this.tenders.map((t) => ({ ...t }))).pipe(delay(150));
  }

  getById(id: string): Observable<ProcessedTender | undefined> {
    const found = this.tenders.find((t) => t.id === id);
    return of(found ? { ...found } : undefined).pipe(delay(100));
  }

  /**
   * Internal mock-only hook: lets the bidder mock repo evolve tender state
   * after writes (e.g. first bidder added → Pending Review flips to
   * Technical Evaluation). In the real HTTP world the backend owns this —
   * the HTTP repository doesn't need an equivalent.
   */
  mutateStatus(tenderId: string, status: ProcessedTender['status']): void {
    const tender = this.tenders.find((t) => t.id === tenderId);
    if (!tender) return;
    tender.status = status;
  }

  /** Internal mock hook: keeps the biddersCount accurate after a write. */
  incrementBiddersCount(tenderId: string): void {
    const tender = this.tenders.find((t) => t.id === tenderId);
    if (!tender) return;
    tender.biddersCount += 1;
  }
}
