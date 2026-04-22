import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface PendingTender {
  id: string;
  name: string;
  uploadedDate: string;
  documentName: string;
}

interface DashboardMetric {
  label: string;
  value: string;
  subtitle: string;
  icon: string;
}

interface TenderStatus {
  title: string;
  count: number;
  trend: string;
}

interface RecentTender {
  reference: string;
  authority: string;
  bids: number;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  constructor(private router: Router) {}
  metrics: DashboardMetric[] = [
    {
      label: 'Total Bids Received',
      value: '124',
      subtitle: 'Across all active tenders',
      icon: 'gavel',
    },
    {
      label: 'Active Evaluations',
      value: '18',
      subtitle: 'Currently under assessment',
      icon: 'analytics',
    },
    {
      label: 'Completed Reviews',
      value: '86',
      subtitle: 'Closed in the last 90 days',
      icon: 'task_alt',
    },
    {
      label: 'Average Confidence',
      value: '81%',
      subtitle: 'Across shortlisted bids',
      icon: 'insights',
    },
  ];

  tenderStatuses: TenderStatus[] = [
    {
      title: 'Pending Review',
      count: 14,
      trend: '+3 from last week',
    },
    {
      title: 'In Technical Evaluation',
      count: 9,
      trend: '+2 from yesterday',
    },
    {
      title: 'Financial Comparison',
      count: 5,
      trend: '2 closing today',
    },
    {
      title: 'Award Recommended',
      count: 3,
      trend: '1 awaiting approval',
    },
  ];

  recentTenders: RecentTender[] = [
    {
      reference: 'ITE/2026/041',
      authority: 'Public Works Division',
      bids: 22,
      status: 'Technical Evaluation',
    },
    {
      reference: 'ITE/2026/037',
      authority: 'Smart City Mission',
      bids: 17,
      status: 'Financial Comparison',
    },
    {
      reference: 'ITE/2026/029',
      authority: 'Rural Infrastructure Board',
      bids: 31,
      status: 'Award Recommended',
    },
  ];

  pendingTenders: PendingTender[] = [
    {
      id: 'TEND-001',
      name: 'Highway Maintenance Contract',
      uploadedDate: '2026-04-20',
      documentName: 'highway_maintenance_2026.pdf',
    },
    {
      id: 'TEND-002',
      name: 'IT Infrastructure Upgrade',
      uploadedDate: '2026-04-19',
      documentName: 'it_infra_upgrade.docx',
    },
    {
      id: 'TEND-003',
      name: 'Water Treatment Plant Expansion',
      uploadedDate: '2026-04-18',
      documentName: 'water_treatment_expansion.pdf',
    },
  ];

  navigateToUpload() {
    this.router.navigate(['/upload']);
  }
}
