import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'noticias',
        loadChildren: () =>
          import('./features/noticias/noticias.routes').then(m => m.noticiasRoutes),
      },
      {
        path: 'scores',
        loadChildren: () =>
          import('./features/scores/scores.routes').then(m => m.scoresRoutes),
      },
      {
        path: 'metricas',
        loadComponent: () =>
          import('./features/metricas/metricas.component').then(m => m.MetricasComponent),
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./features/admin/admin.routes').then(m => m.adminRoutes),
      },
      {
        path: 'juego',
        loadComponent: () =>
          import('./features/juego-platos/juego-platos.component').then(m => m.JuegoPlatosComponent),
      },
      {
        path: 'juegos',
        loadChildren: () =>
          import('./features/juegos/juegos.routes').then(m => m.juegosRoutes),
      },
      {
        path: 'coach',
        loadComponent: () =>
          import('./features/coach/coach.component').then(m => m.CoachComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
