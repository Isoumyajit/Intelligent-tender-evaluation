import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./pages/uploads/ite-tender-form/ite-tender-form.component').then(
        (m) => m.IteTenderFormComponent,
      ),
  },
  {
    path: 'result',
    loadComponent: () =>
      import('./pages/result/result.component').then((m) => m.ResultComponent),
  },
];
