import { Routes } from '@angular/router';

export const scoresRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./scores-shell/scores-shell.component').then(m => m.ScoresShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'entrenamientos',
        pathMatch: 'full',
      },
      {
        path: 'entrenamientos',
        loadComponent: () =>
          import('./entrenamiento-socio-lista/entrenamiento-socio-lista.component')
            .then(m => m.EntrenamientoSocioListaComponent),
      },
      {
        path: 'entrenamientos/:escuadraId',
        loadComponent: () =>
          import('./entrenamiento-socio-detalle/entrenamiento-socio-detalle.component')
            .then(m => m.EntrenamientoSocioDetalleComponent),
      },
      {
        path: 'torneos',
        loadComponent: () =>
          import('./torneo-socio-lista/torneo-socio-lista.component')
            .then(m => m.TorneoSocioListaComponent),
      },
      {
        path: 'torneos/:id',
        loadComponent: () =>
          import('./torneo-socio-detalle/torneo-socio-detalle.component')
            .then(m => m.TorneoSocioDetalleComponent),
      },
    ],
  },
];
