import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntrenamientoService } from '../entrenamiento.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-form-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-entrenamiento.component.html',
  styleUrl: './form-entrenamiento.component.scss',
})
export class FormEntrenamientoComponent {
  private entrenamientoService = inject(EntrenamientoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  fecha: string = new Date().toISOString().split('T')[0];
  loading = false;
  error = '';

  async onSubmit(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');
      const id = await this.entrenamientoService.create(this.fecha, user.id);
      this.router.navigate(['/admin/entrenamientos', id]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al crear entrenamiento';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/scores']);
  }
}
