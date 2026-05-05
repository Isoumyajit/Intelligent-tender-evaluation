import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import {
  AddBidderPayload,
  BidderRepository,
} from '../abstractions/bidder-repository';
import { CriterionCatalogProvider } from '../evaluation/criterion-catalog.provider';
import {
  BidderDocument,
  BidderDocumentCategory,
  BidderEvaluation,
  BidderSummary,
  CriterionCategory,
} from '../models/evaluation.models';
import { MockTenderRepository } from './mock-tender.repository';
import { RefreshBus } from './refresh-bus';

@Injectable({ providedIn: 'root' })
export class MockBidderRepository implements BidderRepository {
  private readonly catalog = inject(CriterionCatalogProvider);
  private readonly tenderRepo = inject(MockTenderRepository);
  private readonly refresh = inject(RefreshBus);

  private readonly summariesByTender: Record<string, BidderSummary[]> = {
    'TEND-2026-041': [
      {
        id: 'BID-041-01',
        tenderId: 'TEND-2026-041',
        name: 'Constellation Infrastructure Ltd.',
        registrationNo: 'CIN-U45201KA2008PLC045612',
        confidenceScore: 92,
        rank: 1,
        overallStatus: 'Qualified',
        technicalScore: 94,
        financialScore: 88,
        complianceScore: 96,
        bidAmount: '₹ 46.2 Cr',
        submittedOn: '2026-05-18',
        documentsCount: 14,
        totalSize: '38.4 MB',
      },
      {
        id: 'BID-041-02',
        tenderId: 'TEND-2026-041',
        name: 'Meridian Road Builders Pvt. Ltd.',
        registrationNo: 'CIN-U45203MH2012PTC067834',
        confidenceScore: 85,
        rank: 2,
        overallStatus: 'Qualified',
        technicalScore: 86,
        financialScore: 82,
        complianceScore: 89,
        bidAmount: '₹ 47.8 Cr',
        submittedOn: '2026-05-20',
        documentsCount: 12,
        totalSize: '29.7 MB',
      },
      {
        id: 'BID-041-03',
        tenderId: 'TEND-2026-041',
        name: 'Sagara Construction Co.',
        registrationNo: 'CIN-U45209KA2015PLC082991',
        confidenceScore: 74,
        rank: 3,
        overallStatus: 'Under Review',
        technicalScore: 78,
        financialScore: 70,
        complianceScore: 72,
        bidAmount: '₹ 49.1 Cr',
        submittedOn: '2026-05-21',
        documentsCount: 11,
        totalSize: '24.2 MB',
      },
      {
        id: 'BID-041-04',
        tenderId: 'TEND-2026-041',
        name: 'Prabhat Engineering Works',
        registrationNo: 'CIN-U45205DL2010PTC205471',
        confidenceScore: 61,
        rank: 4,
        overallStatus: 'Under Review',
        technicalScore: 62,
        financialScore: 64,
        complianceScore: 58,
        bidAmount: '₹ 51.4 Cr',
        submittedOn: '2026-05-19',
        documentsCount: 10,
        totalSize: '22.0 MB',
      },
      {
        id: 'BID-041-05',
        tenderId: 'TEND-2026-041',
        name: 'Nirmal Highways Ltd.',
        registrationNo: 'CIN-U45203GJ2009PLC058239',
        confidenceScore: 42,
        rank: 5,
        overallStatus: 'Disqualified',
        technicalScore: 48,
        financialScore: 52,
        complianceScore: 34,
        bidAmount: '₹ 54.7 Cr',
        submittedOn: '2026-05-22',
        documentsCount: 9,
        totalSize: '18.6 MB',
      },
    ],
    'TEND-2026-037': [
      {
        id: 'BID-037-01',
        tenderId: 'TEND-2026-037',
        name: 'Nexora Systems Pvt. Ltd.',
        registrationNo: 'CIN-U72200KA2011PTC065432',
        confidenceScore: 89,
        rank: 1,
        overallStatus: 'Qualified',
        technicalScore: 92,
        financialScore: 84,
        complianceScore: 91,
        bidAmount: '₹ 20.3 Cr',
        submittedOn: '2026-05-20',
        documentsCount: 13,
        totalSize: '32.1 MB',
      },
      {
        id: 'BID-037-02',
        tenderId: 'TEND-2026-037',
        name: 'UrbanGrid Technologies',
        registrationNo: 'CIN-U72900MH2013PTC078901',
        confidenceScore: 81,
        rank: 2,
        overallStatus: 'Qualified',
        technicalScore: 82,
        financialScore: 79,
        complianceScore: 83,
        bidAmount: '₹ 21.5 Cr',
        submittedOn: '2026-05-21',
        documentsCount: 11,
        totalSize: '27.8 MB',
      },
      {
        id: 'BID-037-03',
        tenderId: 'TEND-2026-037',
        name: 'Zenith IT Solutions',
        registrationNo: 'CIN-U72200HR2010PLC043210',
        confidenceScore: 68,
        rank: 3,
        overallStatus: 'Under Review',
        technicalScore: 71,
        financialScore: 65,
        complianceScore: 69,
        bidAmount: '₹ 22.9 Cr',
        submittedOn: '2026-05-22',
        documentsCount: 10,
        totalSize: '24.5 MB',
      },
      {
        id: 'BID-037-04',
        tenderId: 'TEND-2026-037',
        name: 'Datalink Infoware',
        registrationNo: 'CIN-U72900TN2014PTC097653',
        confidenceScore: 55,
        rank: 4,
        overallStatus: 'Disqualified',
        technicalScore: 60,
        financialScore: 58,
        complianceScore: 46,
        bidAmount: '₹ 23.6 Cr',
        submittedOn: '2026-05-22',
        documentsCount: 8,
        totalSize: '19.9 MB',
      },
    ],
    'TEND-2026-029': [
      {
        id: 'BID-029-01',
        tenderId: 'TEND-2026-029',
        name: 'Hydrotech Engineers Ltd.',
        registrationNo: 'CIN-U45301MH2007PLC052341',
        confidenceScore: 95,
        rank: 1,
        overallStatus: 'Qualified',
        technicalScore: 96,
        financialScore: 92,
        complianceScore: 97,
        bidAmount: '₹ 73.4 Cr',
        submittedOn: '2026-05-14',
        documentsCount: 16,
        totalSize: '42.1 MB',
      },
      {
        id: 'BID-029-02',
        tenderId: 'TEND-2026-029',
        name: 'AquaCore Industries',
        registrationNo: 'CIN-U45303GJ2009PTC054782',
        confidenceScore: 87,
        rank: 2,
        overallStatus: 'Qualified',
        technicalScore: 88,
        financialScore: 86,
        complianceScore: 87,
        bidAmount: '₹ 74.8 Cr',
        submittedOn: '2026-05-15',
        documentsCount: 14,
        totalSize: '36.5 MB',
      },
      {
        id: 'BID-029-03',
        tenderId: 'TEND-2026-029',
        name: 'Bharat Water Works',
        registrationNo: 'CIN-U45305UP2010PLC089345',
        confidenceScore: 79,
        rank: 3,
        overallStatus: 'Qualified',
        technicalScore: 80,
        financialScore: 78,
        complianceScore: 79,
        bidAmount: '₹ 75.6 Cr',
        submittedOn: '2026-05-16',
        documentsCount: 13,
        totalSize: '31.2 MB',
      },
      {
        id: 'BID-029-04',
        tenderId: 'TEND-2026-029',
        name: 'Pristine Utilities Pvt. Ltd.',
        registrationNo: 'CIN-U45301KL2012PTC073218',
        confidenceScore: 66,
        rank: 4,
        overallStatus: 'Under Review',
        technicalScore: 68,
        financialScore: 62,
        complianceScore: 68,
        bidAmount: '₹ 77.2 Cr',
        submittedOn: '2026-05-17',
        documentsCount: 11,
        totalSize: '26.8 MB',
      },
      {
        id: 'BID-029-05',
        tenderId: 'TEND-2026-029',
        name: 'Swachh Jal Corporation',
        registrationNo: 'CIN-U45309RJ2013PLC067432',
        confidenceScore: 51,
        rank: 5,
        overallStatus: 'Under Review',
        technicalScore: 56,
        financialScore: 54,
        complianceScore: 43,
        bidAmount: '₹ 79.0 Cr',
        submittedOn: '2026-05-18',
        documentsCount: 10,
        totalSize: '23.4 MB',
      },
      {
        id: 'BID-029-06',
        tenderId: 'TEND-2026-029',
        name: 'Shakti Infraworks',
        registrationNo: 'CIN-U45301AP2011PTC076543',
        confidenceScore: 38,
        rank: 6,
        overallStatus: 'Disqualified',
        technicalScore: 42,
        financialScore: 45,
        complianceScore: 28,
        bidAmount: '₹ 81.5 Cr',
        submittedOn: '2026-05-18',
        documentsCount: 8,
        totalSize: '17.1 MB',
      },
    ],
    'TEND-2026-022': [
      {
        id: 'BID-022-01',
        tenderId: 'TEND-2026-022',
        name: 'SunArc Renewables Ltd.',
        registrationNo: 'CIN-U40108KA2012PLC064321',
        confidenceScore: 88,
        rank: 1,
        overallStatus: 'Qualified',
        technicalScore: 90,
        financialScore: 85,
        complianceScore: 89,
        bidAmount: '₹ 12.1 Cr',
        submittedOn: '2026-05-05',
        documentsCount: 12,
        totalSize: '28.5 MB',
      },
      {
        id: 'BID-022-02',
        tenderId: 'TEND-2026-022',
        name: 'GreenVolt Energy Solutions',
        registrationNo: 'CIN-U40109MH2013PTC074321',
        confidenceScore: 76,
        rank: 2,
        overallStatus: 'Qualified',
        technicalScore: 78,
        financialScore: 74,
        complianceScore: 76,
        bidAmount: '₹ 12.6 Cr',
        submittedOn: '2026-05-06',
        documentsCount: 10,
        totalSize: '23.9 MB',
      },
      {
        id: 'BID-022-03',
        tenderId: 'TEND-2026-022',
        name: 'Photon Power Systems',
        registrationNo: 'CIN-U40108TN2014PTC085439',
        confidenceScore: 63,
        rank: 3,
        overallStatus: 'Under Review',
        technicalScore: 66,
        financialScore: 58,
        complianceScore: 65,
        bidAmount: '₹ 13.2 Cr',
        submittedOn: '2026-05-08',
        documentsCount: 9,
        totalSize: '20.4 MB',
      },
    ],
    'TEND-2026-018': [
      {
        id: 'BID-018-01',
        tenderId: 'TEND-2026-018',
        name: 'Meridian Road Builders Pvt. Ltd.',
        registrationNo: 'CIN-U45203MH2012PTC067834',
        confidenceScore: 91,
        rank: 1,
        overallStatus: 'Qualified',
        technicalScore: 93,
        financialScore: 88,
        complianceScore: 92,
        bidAmount: '₹ 178.5 Cr',
        submittedOn: '2026-04-22',
        documentsCount: 18,
        totalSize: '54.2 MB',
      },
      {
        id: 'BID-018-02',
        tenderId: 'TEND-2026-018',
        name: 'Constellation Infrastructure Ltd.',
        registrationNo: 'CIN-U45201KA2008PLC045612',
        confidenceScore: 86,
        rank: 2,
        overallStatus: 'Qualified',
        technicalScore: 88,
        financialScore: 82,
        complianceScore: 88,
        bidAmount: '₹ 180.2 Cr',
        submittedOn: '2026-04-23',
        documentsCount: 17,
        totalSize: '49.7 MB',
      },
      {
        id: 'BID-018-03',
        tenderId: 'TEND-2026-018',
        name: 'Spectra Urban Infra',
        registrationNo: 'CIN-U45200MH2011PTC065349',
        confidenceScore: 80,
        rank: 3,
        overallStatus: 'Qualified',
        technicalScore: 82,
        financialScore: 78,
        complianceScore: 80,
        bidAmount: '₹ 181.9 Cr',
        submittedOn: '2026-04-24',
        documentsCount: 15,
        totalSize: '43.1 MB',
      },
      {
        id: 'BID-018-04',
        tenderId: 'TEND-2026-018',
        name: 'TransLine Civils',
        registrationNo: 'CIN-U45209DL2014PTC082134',
        confidenceScore: 72,
        rank: 4,
        overallStatus: 'Qualified',
        technicalScore: 74,
        financialScore: 70,
        complianceScore: 72,
        bidAmount: '₹ 185.4 Cr',
        submittedOn: '2026-04-25',
        documentsCount: 13,
        totalSize: '37.8 MB',
      },
      {
        id: 'BID-018-05',
        tenderId: 'TEND-2026-018',
        name: 'Everest Engineering Co.',
        registrationNo: 'CIN-U45203UP2009PLC075689',
        confidenceScore: 65,
        rank: 5,
        overallStatus: 'Under Review',
        technicalScore: 68,
        financialScore: 64,
        complianceScore: 63,
        bidAmount: '₹ 188.0 Cr',
        submittedOn: '2026-04-26',
        documentsCount: 12,
        totalSize: '32.4 MB',
      },
      {
        id: 'BID-018-06',
        tenderId: 'TEND-2026-018',
        name: 'Astra Structurals Ltd.',
        registrationNo: 'CIN-U45205HR2011PTC068754',
        confidenceScore: 54,
        rank: 6,
        overallStatus: 'Under Review',
        technicalScore: 58,
        financialScore: 52,
        complianceScore: 52,
        bidAmount: '₹ 192.2 Cr',
        submittedOn: '2026-04-27',
        documentsCount: 11,
        totalSize: '28.9 MB',
      },
      {
        id: 'BID-018-07',
        tenderId: 'TEND-2026-018',
        name: 'Bhumika Builders',
        registrationNo: 'CIN-U45201RJ2013PLC071234',
        confidenceScore: 40,
        rank: 7,
        overallStatus: 'Disqualified',
        technicalScore: 44,
        financialScore: 48,
        complianceScore: 28,
        bidAmount: '₹ 197.6 Cr',
        submittedOn: '2026-04-27',
        documentsCount: 9,
        totalSize: '21.5 MB',
      },
    ],
  };

  listForTender(tenderId: string): Observable<BidderSummary[]> {
    const list = this.summariesByTender[tenderId] ?? [];
    return of([...list].sort((a, b) => a.rank - b.rank)).pipe(delay(200));
  }

  getEvaluation(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderEvaluation | undefined> {
    const summary = (this.summariesByTender[tenderId] ?? []).find(
      (b) => b.id === bidderId,
    );
    const evaluation: BidderEvaluation | undefined = summary
      ? { ...summary, criteria: this.catalog.build(summary) }
      : undefined;
    return of(evaluation).pipe(delay(150));
  }

  listDocuments(
    tenderId: string,
    bidderId: string,
  ): Observable<BidderDocument[]> {
    const summary = (this.summariesByTender[tenderId] ?? []).find(
      (b) => b.id === bidderId,
    );
    if (!summary) return of([]).pipe(delay(120));

    // Deduplicate by document name across all evidence in the criteria.
    const seen = new Map<string, { category: CriterionCategory }>();
    for (const crit of this.catalog.build(summary)) {
      for (const ev of crit.evidence) {
        if (!seen.has(ev.documentName)) {
          seen.set(ev.documentName, { category: crit.category });
        }
      }
    }

    const docs: BidderDocument[] = Array.from(seen.entries()).map(
      ([fileName, { category }], idx) =>
        this.synthesizeDocument(summary, fileName, category, idx),
    );

    return of(docs).pipe(delay(200));
  }

  addBidderToTender(
    tenderId: string,
    payload: AddBidderPayload,
  ): Observable<BidderSummary> {
    const existing = this.summariesByTender[tenderId] ?? [];
    const rank = existing.length + 1;
    const summary: BidderSummary = {
      id: `${tenderId}-BID-${rank}-${Date.now().toString(36)}`,
      tenderId,
      name: payload.bidderName,
      registrationNo: `CIN-PENDING-${rank}`,
      confidenceScore: 70,
      rank,
      overallStatus: 'Under Review',
      technicalScore: 0,
      financialScore: 0,
      complianceScore: 0,
      bidAmount: '—',
      submittedOn: new Date().toISOString().split('T')[0],
      documentsCount: payload.fileCount ?? 0,
      totalSize: this.humanSize(payload.totalSizeBytes ?? 0),
    };

    this.summariesByTender[tenderId] = [...existing, summary];

    // Policy: once the first bidder lands, a Pending Review tender moves
    // into Technical Evaluation. The real backend owns this rule in HTTP
    // world; here we mimic it so pages can just re-read after write.
    this.tenderRepo.incrementBiddersCount(tenderId);
    if (existing.length === 0) {
      this.tenderRepo.mutateStatus(tenderId, 'Technical Evaluation');
    }

    return of(summary).pipe(
      delay(200),
      tap(() => this.refresh.emitTendersChanged()),
    );
  }

  private humanSize(bytes: number): string {
    if (bytes <= 0) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private synthesizeDocument(
    summary: BidderSummary,
    fileName: string,
    criterionCategory: CriterionCategory,
    index: number,
  ): BidderDocument {
    const lower = fileName.toLowerCase();
    const mimeType = this.guessMimeType(lower);
    const category = this.mapCategory(criterionCategory);
    const baseDate = new Date(summary.submittedOn);
    baseDate.setDate(baseDate.getDate() - index);
    return {
      id: `${summary.id}-DOC-${index + 1}`,
      tenderId: summary.tenderId,
      bidderId: summary.id,
      fileName,
      mimeType,
      sizeBytes: this.pseudoSize(fileName, summary.id),
      uploadedOn: baseDate.toISOString().split('T')[0],
      pageCount: this.pseudoPageCount(fileName, summary.id),
      category,
      description: this.shortDescription(lower),
    };
  }

  private guessMimeType(lowerName: string): string {
    if (lowerName.endsWith('.pdf')) return 'application/pdf';
    if (lowerName.endsWith('.xlsx')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    if (lowerName.endsWith('.xls')) return 'application/vnd.ms-excel';
    if (lowerName.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (lowerName.endsWith('.doc')) return 'application/msword';
    if (lowerName.endsWith('.png')) return 'image/png';
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    return 'application/octet-stream';
  }

  private mapCategory(c: CriterionCategory): BidderDocumentCategory {
    return c;
  }

  private pseudoSize(name: string, salt: string): number {
    // Deterministic pseudo-random between 120 KB and 12 MB.
    const seed = [...(name + salt)].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    return 120 * 1024 + (seed * 7919) % (12 * 1024 * 1024);
  }

  private pseudoPageCount(name: string, salt: string): number | undefined {
    if (!/\.(pdf|docx?|pptx?)$/i.test(name)) return undefined;
    const seed = [...(name + salt)].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    return (seed % 28) + 2;
  }

  private shortDescription(lower: string): string | undefined {
    if (lower.includes('financial')) return 'Audited financial statement';
    if (lower.includes('gst')) return 'GST registration certificate';
    if (lower.includes('pan')) return 'PAN verification record';
    if (lower.includes('completion')) return 'Project completion certificates';
    if (lower.includes('team') || lower.includes('cv')) {
      return 'Key personnel CVs';
    }
    if (lower.includes('equipment')) return 'Equipment & fleet inventory';
    if (lower.includes('price') || lower.includes('bid')) {
      return 'Priced bid document';
    }
    if (lower.includes('emd') || lower.includes('guarantee')) {
      return 'Earnest money / bank guarantee';
    }
    if (lower.includes('affidavit') || lower.includes('declaration')) {
      return 'Self-declaration affidavit';
    }
    if (lower.includes('epfo') || lower.includes('esic')) {
      return 'EPFO/ESIC compliance record';
    }
    return undefined;
  }
}
