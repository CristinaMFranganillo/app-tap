import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registro-confirmacion',
  standalone: true,
  imports: [],
  templateUrl: './registro-confirmacion.component.html',
})
export class RegistroConfirmacionComponent {
  private router = inject(Router);

  // El email se pasa como state de navegación
  email: string = (this.router.getCurrentNavigation()?.extras?.state as { email?: string })?.email ?? '';

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
