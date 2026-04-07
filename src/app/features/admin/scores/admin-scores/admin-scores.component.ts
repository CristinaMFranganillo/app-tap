import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CompeticionService } from '../../../scores/competicion.service';
import { EntrenamientoService } from '../../entrenamientos/entrenamiento.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { Entrenamiento } from '../../../../core/models/entrenamiento.model';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-scores',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './admin-scores.component.html',
  styleUrl: './admin-scores.component.scss',
})
export class AdminScoresComponent {
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  entrenamientos = toSignal(this.entrenamientoService.getAll(), { initialValue: [] as Entrenamiento[] });

  // Inline date picker state
  mostrarPicker = signal(false);
  fechaNueva = signal(new Date().toISOString().split('T')[0]);
  creando = signal(false);
  errorCrear = signal('');

  abrirPicker(): void {
    this.fechaNueva.set(new Date().toISOString().split('T')[0]);
    this.errorCrear.set('');
    this.mostrarPicker.set(true);
  }

  cancelarPicker(): void {
    this.mostrarPicker.set(false);
  }

  async confirmarEntrenamiento(): Promise<void> {
    this.creando.set(true);
    this.errorCrear.set('');
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');
      const id = await this.entrenamientoService.create(this.fechaNueva(), user.id);
      this.mostrarPicker.set(false);
      this.router.navigate(['/admin/entrenamientos', id]);
    } catch (err) {
      this.errorCrear.set(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      this.creando.set(false);
    }
  }

  verEntrenamiento(id: string): void {
    this.router.navigate(['/admin/entrenamientos', id]);
  }

  editarEntrenamiento(id: string): void {
    this.router.navigate(['/admin/entrenamientos', id], { queryParams: { modo: 'editar' } });
  }

  nuevaCompeticion(): void {
    this.router.navigate(['/admin/competiciones/nueva']);
  }

  totalPlatos(c: Competicion): number {
    return c.platosPorSerie * c.numSeries;
  }
}
