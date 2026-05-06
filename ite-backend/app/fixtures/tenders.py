"""Processed-tender fixtures. Mirror the frontend's MockTenderRepository."""

from typing import Any


TENDERS: list[dict[str, Any]] = [
    {
        "id": "TEND-2026-041",
        "reference": "ITE/2026/041",
        "name": "Highway Maintenance Contract - NH44",
        "authority": "Public Works Division",
        "uploaded_date": "2026-04-20",
        "closing_date": "2026-05-30",
        "status": "Technical Evaluation",
        "bidders_count": 5,
        "document_name": "highway_maintenance_2026.pdf",
        "document_size": "2.3 MB",
        "estimated_value": "₹ 48.5 Cr",
        "description": (
            "Annual maintenance contract for NH44 stretch covering 312 km "
            "including pothole repair, re-carpeting, and signage."
        ),
    },
    {
        "id": "TEND-2026-037",
        "reference": "ITE/2026/037",
        "name": "Smart City IT Infrastructure Upgrade",
        "authority": "Smart City Mission",
        "uploaded_date": "2026-04-19",
        "closing_date": "2026-06-05",
        "status": "Financial Comparison",
        "bidders_count": 4,
        "document_name": "it_infra_upgrade.docx",
        "document_size": "1.8 MB",
        "estimated_value": "₹ 22.0 Cr",
        "description": (
            "Upgrade of city-wide surveillance, Wi-Fi backbone, and data "
            "center refresh across 14 zones."
        ),
    },
    {
        "id": "TEND-2026-029",
        "reference": "ITE/2026/029",
        "name": "Water Treatment Plant Expansion",
        "authority": "Rural Infrastructure Board",
        "uploaded_date": "2026-04-18",
        "closing_date": "2026-05-25",
        "status": "Award Recommended",
        "bidders_count": 6,
        "document_name": "water_treatment_expansion.pdf",
        "document_size": "3.1 MB",
        "estimated_value": "₹ 76.2 Cr",
        "description": (
            "Capacity expansion from 40 MLD to 75 MLD including new "
            "clarifier, filter bed, and SCADA integration."
        ),
    },
    {
        "id": "TEND-2026-022",
        "reference": "ITE/2026/022",
        "name": "Urban Solar Rooftop Programme",
        "authority": "Renewable Energy Agency",
        "uploaded_date": "2026-04-10",
        "closing_date": "2026-05-15",
        "status": "Pending Review",
        "bidders_count": 3,
        "document_name": "solar_rooftop_2026.pdf",
        "document_size": "1.5 MB",
        "estimated_value": "₹ 12.8 Cr",
        "description": (
            "Installation of 8 MW of rooftop solar across government "
            "buildings under CAPEX model."
        ),
    },
    {
        "id": "TEND-2026-018",
        "reference": "ITE/2026/018",
        "name": "Metro Station Civil Works - Phase III",
        "authority": "Metropolitan Transport Authority",
        "uploaded_date": "2026-03-28",
        "closing_date": "2026-05-10",
        "status": "Technical Evaluation",
        "bidders_count": 7,
        "document_name": "metro_phase3_civil.pdf",
        "document_size": "4.2 MB",
        "estimated_value": "₹ 184.0 Cr",
        "description": (
            "Civil works for three underground stations including tunnel "
            "boring support and finishing."
        ),
    },
]
