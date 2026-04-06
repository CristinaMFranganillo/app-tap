import { Routes } from '@angular/router';

export const noticiasRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lista/lista-noticias.component').then(m => m.ListaNoticiasComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./detalle/detalle-noticia.component').then(m => m.DetalleNoticiaComponent),
  },
];
