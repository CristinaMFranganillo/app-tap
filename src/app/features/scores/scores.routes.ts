import { Routes } from '@angular/router';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '<p class="p-4 text-sm">Scores — próximamente</p>' })
class ScoresPlaceholderComponent {}

export const scoresRoutes: Routes = [
  { path: '', component: ScoresPlaceholderComponent },
];
