import { Routes } from '@angular/router';

export const juegosRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./hub/juegos-hub.component').then(m => m.JuegosHubComponent),
  },
  {
    path: 'reflejos',
    loadComponent: () =>
      import('./reflejos/reflejos.component').then(m => m.ReflejosComponent),
  },
  {
    path: 'lateralidad',
    loadComponent: () =>
      import('./lateralidad/lateralidad.component').then(m => m.LateralidadComponent),
  },
];
