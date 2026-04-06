import { Routes } from '@angular/router';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '<p class="p-4 text-sm">Noticias — próximamente</p>' })
class NoticiasPlaceholderComponent {}

export const noticiasRoutes: Routes = [
  { path: '', component: NoticiasPlaceholderComponent },
];
