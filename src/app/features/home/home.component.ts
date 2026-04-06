import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <div class="p-4">
      <h2 class="text-brand-dark font-extrabold text-[12px] uppercase tracking-wider mb-3">Inicio</h2>
      <p class="text-[10px] text-gray-500 font-medium">Bienvenido a Campo de Tiro San Isidro.</p>
    </div>
  `,
})
export class HomeComponent {}
