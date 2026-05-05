import { Routes } from '@angular/router';
import { RoutePaths } from './core/routing/app-routes';

export const routes: Routes = [
  {
    path: '',
    redirectTo: RoutePaths.DASHBOARD,
    pathMatch: 'full',
  },
  {
    path: RoutePaths.DASHBOARD,
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: RoutePaths.UPLOAD,
    loadComponent: () =>
      import('./pages/uploads/ite-tender-form/ite-tender-form.component').then(
        (m) => m.IteTenderFormComponent,
      ),
  },
  {
    path: RoutePaths.TENDERS,
    loadComponent: () =>
      import('./pages/tender-list/tender-list.component').then(
        (m) => m.TenderListComponent,
      ),
  },
  {
    path: RoutePaths.TENDER_BIDDERS,
    loadComponent: () =>
      import('./pages/bidder-list/bidder-list.component').then(
        (m) => m.BidderListComponent,
      ),
  },
  {
    path: RoutePaths.BIDDER_DOCUMENTS,
    loadComponent: () =>
      import('./pages/bidder-documents/bidder-documents.component').then(
        (m) => m.BidderDocumentsComponent,
      ),
  },
  {
    path: RoutePaths.BIDDER_EVALUATION,
    loadComponent: () =>
      import('./pages/evaluation-report/evaluation-report.component').then(
        (m) => m.EvaluationReportComponent,
      ),
  },
  {
    path: '**',
    redirectTo: RoutePaths.DASHBOARD,
  },
];
