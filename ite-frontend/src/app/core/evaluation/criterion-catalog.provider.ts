import { Injectable, inject } from '@angular/core';
import {
  BidderSummary,
  EvaluationCriterion,
} from '../models/evaluation.models';
import { EvaluationScorer } from './evaluation-scorer';

/**
 * Produces the evaluation criteria for a given bidder summary. In the
 * real product this would be sourced from a per-tender template stored
 * in the backend. For now it returns a single default catalog
 * deterministically shaped by the bidder's confidence score so the UI
 * exercises every pass/partial/fail path.
 */
@Injectable({ providedIn: 'root' })
export class CriterionCatalogProvider {
  private readonly scorer = inject(EvaluationScorer);

  build(bidder: BidderSummary): EvaluationCriterion[] {
    const tier = this.scorer.tier(bidder.confidenceScore);
    const strong = tier === 'high';
    const mid = tier === 'medium';
    const weak = tier === 'low';
    const { id, name, bidAmount, confidenceScore } = bidder;

    return [
      {
        id: `${id}-C1`,
        category: 'Eligibility',
        title: 'Minimum Annual Turnover',
        requirement:
          'Average annual turnover ≥ ₹ 25 Cr in last 3 financial years',
        status: strong ? 'passed' : mid ? 'passed' : 'failed',
        weight: 15,
        score: strong ? 15 : mid ? 13 : 4,
        evidence: [
          {
            documentName: 'audited_financials_FY24.pdf',
            pageOrSection: 'Page 12 - Statement of P&L',
            excerpt: strong
              ? `Total revenue for FY24: ₹ ${(35 + confidenceScore / 3).toFixed(2)} Cr; 3-year average ₹ ${(32 + confidenceScore / 4).toFixed(2)} Cr.`
              : mid
                ? 'Total revenue for FY24: ₹ 28.4 Cr; 3-year average ₹ 26.1 Cr (meets threshold by narrow margin).'
                : 'Total revenue for FY24: ₹ 18.7 Cr; 3-year average ₹ 16.9 Cr (below required ₹ 25 Cr).',
            extractedValue: strong
              ? '3-year avg turnover ≥ ₹ 25 Cr ✓'
              : mid
                ? '3-year avg turnover = ₹ 26.1 Cr'
                : '3-year avg turnover = ₹ 16.9 Cr',
            confidence: strong ? 98 : mid ? 92 : 94,
          },
        ],
        notes: weak
          ? 'Turnover below the required threshold; automatic disqualifier unless waived.'
          : undefined,
      },
      {
        id: `${id}-C2`,
        category: 'Eligibility',
        title: 'Valid GST & PAN Registration',
        requirement: 'Active GST and PAN with no cancellation notices',
        status: weak ? 'partial' : 'passed',
        weight: 5,
        score: weak ? 3 : 5,
        evidence: [
          {
            documentName: 'gst_registration_certificate.pdf',
            pageOrSection: 'Page 1 - Certificate summary',
            excerpt:
              'GSTIN 29ABCDE1234F1Z5 issued on 2018-07-15, status: ACTIVE.',
            extractedValue: 'GSTIN ACTIVE ✓',
            confidence: 99,
          },
          {
            documentName: 'pan_card.pdf',
            pageOrSection: 'Whole document',
            excerpt:
              'PAN ABCDE1234F verified against digital Aadhaar-linked PAN registry.',
            extractedValue: 'PAN verified ✓',
            confidence: 99,
          },
        ],
      },
      {
        id: `${id}-C3`,
        category: 'Technical',
        title: 'Similar Works Experience',
        requirement:
          'Completed ≥ 2 similar-scope projects worth ≥ ₹ 20 Cr each in last 5 years',
        status: strong ? 'passed' : mid ? 'partial' : 'failed',
        weight: 25,
        score: strong ? 25 : mid ? 17 : 6,
        evidence: [
          {
            documentName: 'completion_certificates_bundle.pdf',
            pageOrSection: 'Pages 3-11 - Project certificates',
            excerpt: strong
              ? 'Certified completion of 3 projects: NH7 resurfacing (₹ 32 Cr), State Hwy-12 widening (₹ 28 Cr), NH44 bypass (₹ 41 Cr). All signed by competent authority.'
              : mid
                ? 'Certified completion of 1 project: NH7 resurfacing (₹ 22 Cr). Second project at ₹ 14 Cr below threshold.'
                : 'Only one project cited, documentation missing client sign-off for value verification.',
            extractedValue: strong
              ? '3 similar works ≥ ₹ 20 Cr each ✓'
              : mid
                ? '1 of 2 required works verified'
                : '0 of 2 required works verified',
            confidence: strong ? 96 : mid ? 88 : 72,
          },
        ],
        notes: mid
          ? 'Short by one project of similar scope. Recommend clarification request.'
          : weak
            ? 'Does not meet minimum technical eligibility.'
            : undefined,
      },
      {
        id: `${id}-C4`,
        category: 'Technical',
        title: 'Key Personnel & Qualifications',
        requirement:
          'Project Manager with ≥ 10 years experience; Technical Lead with ≥ 8 years',
        status: strong ? 'passed' : mid ? 'passed' : 'partial',
        weight: 10,
        score: strong ? 10 : mid ? 9 : 5,
        evidence: [
          {
            documentName: 'team_cvs.pdf',
            pageOrSection: 'Section A - Project Manager CV',
            excerpt: strong
              ? 'PM: Ramesh Iyer, BE (Civil), 18 years experience. Led 4 NH-class projects.'
              : mid
                ? 'PM: Anand Verma, BE (Civil), 12 years experience. Led 2 state highway projects.'
                : 'PM: Vikas Patil, Diploma (Civil), 9 years experience — below requirement.',
            extractedValue: strong
              ? 'PM experience: 18 yrs ✓'
              : mid
                ? 'PM experience: 12 yrs ✓'
                : 'PM experience: 9 yrs ✗',
            confidence: 94,
          },
        ],
      },
      {
        id: `${id}-C5`,
        category: 'Technical',
        title: 'Equipment & Machinery Availability',
        requirement:
          'Owned or leased fleet for concreting, paving, earth moving',
        status: strong || mid ? 'passed' : 'partial',
        weight: 10,
        score: strong ? 10 : mid ? 8 : 5,
        evidence: [
          {
            documentName: 'equipment_inventory.xlsx',
            pageOrSection: 'Sheet: Fleet Summary',
            excerpt:
              strong || mid
                ? 'Paver x3 (owned), Asphalt mixer x2 (owned), JCB x5 (owned), Roller x4 (leased).'
                : 'Partial fleet: 1 paver, 1 mixer. No rollers on record. Leasing agreement attached but unsigned.',
            extractedValue:
              strong || mid
                ? 'Fleet complete ✓'
                : 'Fleet incomplete — roller missing',
            confidence: 90,
          },
        ],
      },
      {
        id: `${id}-C6`,
        category: 'Financial',
        title: 'Bid Price within Estimated Range',
        requirement: 'Bid value within ±10% of estimated contract value',
        status: 'passed',
        weight: 15,
        score: strong ? 15 : mid ? 13 : 11,
        evidence: [
          {
            documentName: 'price_bid.pdf',
            pageOrSection: 'Summary page',
            excerpt: `Quoted bid: ${bidAmount}. Deviation from estimate: within permissible band.`,
            extractedValue: `Bid: ${bidAmount}`,
            confidence: 97,
          },
        ],
      },
      {
        id: `${id}-C7`,
        category: 'Financial',
        title: 'Earnest Money Deposit (EMD)',
        requirement: 'EMD of 2% of estimated value, via DD or bank guarantee',
        status: weak ? 'failed' : 'passed',
        weight: 5,
        score: weak ? 0 : 5,
        evidence: [
          {
            documentName: 'emd_bank_guarantee.pdf',
            pageOrSection: 'Page 1 - BG details',
            excerpt: weak
              ? 'EMD bank guarantee dated 2026-05-22 amounting to ₹ 0.55 Cr, below required 2% (₹ 0.97 Cr).'
              : 'EMD bank guarantee from SBI dated 2026-05-14 amounting to 2% of estimated value; valid for 120 days.',
            extractedValue: weak ? 'EMD under-funded ✗' : 'EMD 2% ✓',
            confidence: 98,
          },
        ],
        notes: weak
          ? 'Insufficient EMD makes bid non-responsive under clause 4.3 of RFP.'
          : undefined,
      },
      {
        id: `${id}-C8`,
        category: 'Compliance',
        title: 'Blacklisting / Debarment Declaration',
        requirement:
          'No active blacklisting by any central/state authority in last 5 years',
        status: weak ? 'failed' : 'passed',
        weight: 10,
        score: weak ? 0 : 10,
        evidence: [
          {
            documentName: 'self_declaration_affidavit.pdf',
            pageOrSection: 'Declaration clause 3',
            excerpt: weak
              ? `${name} was debarred by PWD-UP from 2023-08 to 2025-02 — disclosed in affidavit.`
              : `Self-declaration by ${name} affirming no debarment; notarised on 2026-05-10.`,
            extractedValue: weak ? 'Debarment on record ✗' : 'Clean record ✓',
            confidence: weak ? 91 : 99,
          },
        ],
        notes: weak
          ? 'Past debarment flagged. Refer to procurement committee for final call.'
          : undefined,
      },
      {
        id: `${id}-C9`,
        category: 'Compliance',
        title: 'Labour Welfare & ESI/EPF Compliance',
        requirement:
          'Active EPFO & ESIC registration with no pending dues > 90 days',
        status: strong ? 'passed' : mid ? 'passed' : 'partial',
        weight: 5,
        score: strong ? 5 : mid ? 5 : 3,
        evidence: [
          {
            documentName: 'epfo_esic_statement.pdf',
            pageOrSection: 'Page 2 - Dues summary',
            excerpt:
              strong || mid
                ? 'EPFO code KN/BNG/12345 active, all dues cleared till March 2026.'
                : 'ESIC dues of ₹ 3.2 L pending since Dec 2025 (123 days).',
            extractedValue:
              strong || mid ? 'No pending dues ✓' : 'Pending dues > 90d ⚠',
            confidence: 95,
          },
        ],
      },
    ];
  }
}
