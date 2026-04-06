import { Routes } from '@angular/router';

export const scoresRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ranking/scores-ranking.component').then(m => m.ScoresRankingComponent),
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('./historial/scores-historial.component').then(m => m.ScoresHistorialComponent),
  },
];
