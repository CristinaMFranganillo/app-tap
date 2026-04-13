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
  // Scores (entrenamientos admin)
  {
    path: 'scores',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/admin-scores/admin-scores.component').then(m => m.AdminScoresComponent),
  },
  // ── Torneos ──────────────────────────────────────────────────────────
  {
    path: 'torneos',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./torneos/lista-torneos/lista-torneos.component').then(m => m.ListaTorneosComponent),
  },
  {
    path: 'torneos/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./torneos/detalle-torneo/detalle-torneo.component').then(m => m.DetalleTorneoComponent),
  },
  {
    path: 'torneos/:id/inscripciones',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./torneos/inscripciones-torneo/inscripciones-torneo.component').then(m => m.InscripcionesTorneoComponent),
  },
  {
    path: 'torneos/:id/escuadra/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./torneos/form-escuadra-torneo/form-escuadra-torneo.component').then(m => m.FormEscuadraTorneoComponent),
  },
  {
    path: 'torneos/:torneoId/escuadra/:escuadraId/resultados',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./torneos/registrar-resultado-torneo/registrar-resultado-torneo.component').then(m => m.RegistrarResultadoTorneoComponent),
  },
  // ── Caja ─────────────────────────────────────────────────────────────────
  {
    path: 'caja',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./caja/caja.component').then(m => m.CajaComponent),
  },
  {
    path: 'caja/tarifas',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },   // solo admin puede cambiar precios
    loadComponent: () =>
      import('./caja/config-tarifas/config-tarifas.component').then(m => m.ConfigTarifasComponent),
  },
  // ── Entrenamientos ───────────────────────────────────────────────────────
  {
    path: 'entrenamientos/dia/:fecha',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./entrenamientos/detalle-dia-entrenamiento/detalle-dia-entrenamiento.component')
        .then(m => m.DetalleDiaEntrenamientoComponent),
  },
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
