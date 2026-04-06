import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const adminRoutes: Routes = [
  // Socios
  {
    path: 'socios',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/lista-socios/lista-socios.component').then(m => m.ListaSociosComponent),
  },
  {
    path: 'socios/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  {
    path: 'socios/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  // Noticias
  {
    path: 'noticias',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/lista-noticias-admin/lista-noticias-admin.component').then(m => m.ListaNoticiasAdminComponent),
  },
  {
    path: 'noticias/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  {
    path: 'noticias/:id/editar',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  // Scores
  {
    path: 'scores/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/form-score/form-score.component').then(m => m.FormScoreComponent),
  },
  // Competiciones
  {
    path: 'competiciones/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./competiciones/form-competicion/form-competicion.component').then(m => m.FormCompeticionComponent),
  },
];
