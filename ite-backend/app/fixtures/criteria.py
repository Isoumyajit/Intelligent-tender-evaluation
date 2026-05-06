"""Criterion catalog builder — pure functions, no state.

Given a bidder summary, returns the list of evaluation criteria with
evidence text shaped by the bidder's confidence tier. This mirrors
CriterionCatalogProvider on the frontend.
"""

from typing import Any


def tier(score: int) -> str:
    if score >= 80:
        return "high"
    if score >= 60:
        return "medium"
    return "low"


def build_criteria(bidder: dict[str, Any]) -> list[dict[str, Any]]:
    bid_id = bidder["id"]
    name = bidder["name"]
    bid_amount = bidder["bid_amount"]
    confidence_score = bidder["confidence_score"]
    t = tier(confidence_score)
    strong = t == "high"
    mid = t == "medium"
    weak = t == "low"

    return [
        {
            "id": f"{bid_id}-C1",
            "category": "Eligibility",
            "title": "Minimum Annual Turnover",
            "requirement": "Average annual turnover ≥ ₹ 25 Cr in last 3 financial years",
            "status": "passed" if strong or mid else "failed",
            "weight": 15,
            "score": 15 if strong else 13 if mid else 4,
            "evidence": [
                {
                    "document_name": "audited_financials_FY24.pdf",
                    "page_or_section": "Page 12 - Statement of P&L",
                    "excerpt": (
                        f"Total revenue for FY24: ₹ {35 + confidence_score / 3:.2f} Cr; "
                        f"3-year average ₹ {32 + confidence_score / 4:.2f} Cr."
                        if strong
                        else
                        "Total revenue for FY24: ₹ 28.4 Cr; 3-year average ₹ 26.1 Cr "
                        "(meets threshold by narrow margin)."
                        if mid
                        else
                        "Total revenue for FY24: ₹ 18.7 Cr; 3-year average ₹ 16.9 Cr "
                        "(below required ₹ 25 Cr)."
                    ),
                    "extracted_value": (
                        "3-year avg turnover ≥ ₹ 25 Cr ✓"
                        if strong
                        else "3-year avg turnover = ₹ 26.1 Cr"
                        if mid
                        else "3-year avg turnover = ₹ 16.9 Cr"
                    ),
                    "confidence": 98 if strong else 92 if mid else 94,
                }
            ],
            "notes": (
                "Turnover below the required threshold; automatic disqualifier "
                "unless waived."
                if weak
                else None
            ),
        },
        {
            "id": f"{bid_id}-C2",
            "category": "Eligibility",
            "title": "Valid GST & PAN Registration",
            "requirement": "Active GST and PAN with no cancellation notices",
            "status": "partial" if weak else "passed",
            "weight": 5,
            "score": 3 if weak else 5,
            "evidence": [
                {
                    "document_name": "gst_registration_certificate.pdf",
                    "page_or_section": "Page 1 - Certificate summary",
                    "excerpt": (
                        "GSTIN 29ABCDE1234F1Z5 issued on 2018-07-15, status: ACTIVE."
                    ),
                    "extracted_value": "GSTIN ACTIVE ✓",
                    "confidence": 99,
                },
                {
                    "document_name": "pan_card.pdf",
                    "page_or_section": "Whole document",
                    "excerpt": (
                        "PAN ABCDE1234F verified against digital Aadhaar-linked PAN registry."
                    ),
                    "extracted_value": "PAN verified ✓",
                    "confidence": 99,
                },
            ],
        },
        {
            "id": f"{bid_id}-C3",
            "category": "Technical",
            "title": "Similar Works Experience",
            "requirement": (
                "Completed ≥ 2 similar-scope projects worth ≥ ₹ 20 Cr each in last 5 years"
            ),
            "status": "passed" if strong else "partial" if mid else "failed",
            "weight": 25,
            "score": 25 if strong else 17 if mid else 6,
            "evidence": [
                {
                    "document_name": "completion_certificates_bundle.pdf",
                    "page_or_section": "Pages 3-11 - Project certificates",
                    "excerpt": (
                        "Certified completion of 3 projects: NH7 resurfacing (₹ 32 Cr), "
                        "State Hwy-12 widening (₹ 28 Cr), NH44 bypass (₹ 41 Cr). "
                        "All signed by competent authority."
                        if strong
                        else
                        "Certified completion of 1 project: NH7 resurfacing (₹ 22 Cr). "
                        "Second project at ₹ 14 Cr below threshold."
                        if mid
                        else
                        "Only one project cited, documentation missing client sign-off "
                        "for value verification."
                    ),
                    "extracted_value": (
                        "3 similar works ≥ ₹ 20 Cr each ✓"
                        if strong
                        else "1 of 2 required works verified"
                        if mid
                        else "0 of 2 required works verified"
                    ),
                    "confidence": 96 if strong else 88 if mid else 72,
                }
            ],
            "notes": (
                "Short by one project of similar scope. Recommend clarification request."
                if mid
                else "Does not meet minimum technical eligibility."
                if weak
                else None
            ),
        },
        {
            "id": f"{bid_id}-C4",
            "category": "Technical",
            "title": "Key Personnel & Qualifications",
            "requirement": (
                "Project Manager with ≥ 10 years experience; Technical Lead with ≥ 8 years"
            ),
            "status": "passed" if strong or mid else "partial",
            "weight": 10,
            "score": 10 if strong else 9 if mid else 5,
            "evidence": [
                {
                    "document_name": "team_cvs.pdf",
                    "page_or_section": "Section A - Project Manager CV",
                    "excerpt": (
                        "PM: Ramesh Iyer, BE (Civil), 18 years experience. "
                        "Led 4 NH-class projects."
                        if strong
                        else
                        "PM: Anand Verma, BE (Civil), 12 years experience. "
                        "Led 2 state highway projects."
                        if mid
                        else
                        "PM: Vikas Patil, Diploma (Civil), 9 years experience — "
                        "below requirement."
                    ),
                    "extracted_value": (
                        "PM experience: 18 yrs ✓"
                        if strong
                        else "PM experience: 12 yrs ✓"
                        if mid
                        else "PM experience: 9 yrs ✗"
                    ),
                    "confidence": 94,
                }
            ],
        },
        {
            "id": f"{bid_id}-C5",
            "category": "Technical",
            "title": "Equipment & Machinery Availability",
            "requirement": "Owned or leased fleet for concreting, paving, earth moving",
            "status": "passed" if strong or mid else "partial",
            "weight": 10,
            "score": 10 if strong else 8 if mid else 5,
            "evidence": [
                {
                    "document_name": "equipment_inventory.xlsx",
                    "page_or_section": "Sheet: Fleet Summary",
                    "excerpt": (
                        "Paver x3 (owned), Asphalt mixer x2 (owned), JCB x5 (owned), "
                        "Roller x4 (leased)."
                        if strong or mid
                        else
                        "Partial fleet: 1 paver, 1 mixer. No rollers on record. "
                        "Leasing agreement attached but unsigned."
                    ),
                    "extracted_value": (
                        "Fleet complete ✓"
                        if strong or mid
                        else "Fleet incomplete — roller missing"
                    ),
                    "confidence": 90,
                }
            ],
        },
        {
            "id": f"{bid_id}-C6",
            "category": "Financial",
            "title": "Bid Price within Estimated Range",
            "requirement": "Bid value within ±10% of estimated contract value",
            "status": "passed",
            "weight": 15,
            "score": 15 if strong else 13 if mid else 11,
            "evidence": [
                {
                    "document_name": "price_bid.pdf",
                    "page_or_section": "Summary page",
                    "excerpt": (
                        f"Quoted bid: {bid_amount}. Deviation from estimate: "
                        f"within permissible band."
                    ),
                    "extracted_value": f"Bid: {bid_amount}",
                    "confidence": 97,
                }
            ],
        },
        {
            "id": f"{bid_id}-C7",
            "category": "Financial",
            "title": "Earnest Money Deposit (EMD)",
            "requirement": "EMD of 2% of estimated value, via DD or bank guarantee",
            "status": "failed" if weak else "passed",
            "weight": 5,
            "score": 0 if weak else 5,
            "evidence": [
                {
                    "document_name": "emd_bank_guarantee.pdf",
                    "page_or_section": "Page 1 - BG details",
                    "excerpt": (
                        "EMD bank guarantee dated 2026-05-22 amounting to ₹ 0.55 Cr, "
                        "below required 2% (₹ 0.97 Cr)."
                        if weak
                        else
                        "EMD bank guarantee from SBI dated 2026-05-14 amounting to "
                        "2% of estimated value; valid for 120 days."
                    ),
                    "extracted_value": "EMD under-funded ✗" if weak else "EMD 2% ✓",
                    "confidence": 98,
                }
            ],
            "notes": (
                "Insufficient EMD makes bid non-responsive under clause 4.3 of RFP."
                if weak
                else None
            ),
        },
        {
            "id": f"{bid_id}-C8",
            "category": "Compliance",
            "title": "Blacklisting / Debarment Declaration",
            "requirement": (
                "No active blacklisting by any central/state authority in last 5 years"
            ),
            "status": "failed" if weak else "passed",
            "weight": 10,
            "score": 0 if weak else 10,
            "evidence": [
                {
                    "document_name": "self_declaration_affidavit.pdf",
                    "page_or_section": "Declaration clause 3",
                    "excerpt": (
                        f"{name} was debarred by PWD-UP from 2023-08 to 2025-02 — "
                        f"disclosed in affidavit."
                        if weak
                        else
                        f"Self-declaration by {name} affirming no debarment; "
                        f"notarised on 2026-05-10."
                    ),
                    "extracted_value": (
                        "Debarment on record ✗" if weak else "Clean record ✓"
                    ),
                    "confidence": 91 if weak else 99,
                }
            ],
            "notes": (
                "Past debarment flagged. Refer to procurement committee for final call."
                if weak
                else None
            ),
        },
        {
            "id": f"{bid_id}-C9",
            "category": "Compliance",
            "title": "Labour Welfare & ESI/EPF Compliance",
            "requirement": (
                "Active EPFO & ESIC registration with no pending dues > 90 days"
            ),
            "status": "passed" if strong or mid else "partial",
            "weight": 5,
            "score": 5 if strong or mid else 3,
            "evidence": [
                {
                    "document_name": "epfo_esic_statement.pdf",
                    "page_or_section": "Page 2 - Dues summary",
                    "excerpt": (
                        "EPFO code KN/BNG/12345 active, all dues cleared till March 2026."
                        if strong or mid
                        else
                        "ESIC dues of ₹ 3.2 L pending since Dec 2025 (123 days)."
                    ),
                    "extracted_value": (
                        "No pending dues ✓" if strong or mid else "Pending dues > 90d ⚠"
                    ),
                    "confidence": 95,
                }
            ],
        },
    ]
