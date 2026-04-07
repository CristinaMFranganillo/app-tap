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
  // Temporadas (cuotas)
  {
    path: 'temporadas',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./temporadas/lista-temporadas/lista-temporadas.component').then(m => m.ListaTemporadasComponent),
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
  // Scores — panel principal
  {
    path: 'scores',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/admin-scores/admin-scores.component').then(m => m.AdminScoresComponent),
  },
  // Scores — legacy form
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
  // Escuadras
  {
    path: 'scores/escuadra/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/form-escuadra/form-escuadra.component').then(m => m.FormEscuadraComponent),
  },
  // Registrar resultados
  {
    path: 'scores/resultados',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/registrar-resultado/registrar-resultado.component').then(m => m.RegistrarResultadoComponent),
  },
  // Entrenamientos — vista agrupada por día
  {
    path: 'entrenamientos/dia/:fecha',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component')
        .then(m => m.DetalleDiaEntrenamientoComponent),
  },
  // Entrenamientos
  {
    path: 'entrenamientos/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/form-entrenamiento/form-entrenamiento.component')
        .then(m => m.FormEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/detalle-entrenamiento/detalle-entrenamiento.component')
        .then(m => m.DetalleEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:id/escuadra/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/form-escuadra-entrenamiento/form-escuadra-entrenamiento.component')
        .then(m => m.FormEscuadraEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:entrenamientoId/escuadra/:escuadraId/resultados',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/registrar-resultado-entrenamiento/registrar-resultado-entrenamiento.component')
        .then(m => m.RegistrarResultadoEntrenamientoComponent),
  },
  {
    path: 'entrenamientos/:entrenamientoId/escuadra/:escuadraId/resumen',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/resumen-escuadra-entrenamiento/resumen-escuadra-entrenamiento.component')
        .then(m => m.ResumenEscuadraEntrenamientoComponent),
  },
];
