import { Routes } from '@angular/router';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '<p class="p-4 text-sm">Admin — próximamente</p>' })
class AdminPlaceholderComponent {}

export const adminRoutes: Routes = [
  { path: '', component: AdminPlaceholderComponent },
];
