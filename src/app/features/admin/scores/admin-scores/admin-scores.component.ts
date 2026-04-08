import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith, firstValueFrom } from 'rxjs';
import { CompeticionService } from '../../../scores/competicion.service';
import { EntrenamientoService } from '../../entrenamientos/entrenamiento.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { EntrenamientoDia } from '../../../../core/models/entrenamiento.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-admin-scores',
  standalone: true,
  imports: [DatePipe, FormsModule, ConfirmDialogComponent],
  templateUrl: './admin-scores.component.html',
  styleUrl: './admin-scores.component.scss',
})
export class AdminScoresComponent {
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  private refresh$ = new Subject<void>();

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  entrenamientos = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.entrenamientoService.getAllAgrupado())),
    { initialValue: [] as EntrenamientoDia[] }
  );

  // Inline date picker state
  mostrarPicker = signal(false);
  fechaNueva = signal(new Date().toISOString().split('T')[0]);
  creando = signal(false);
  errorCrear = signal('');

  // Delete state
  pendingDeleteFecha = signal<string | null>(null);
  eliminando = signal(false);
  errorEliminar = signal('');

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

  verEntrenamiento(fecha: string): void {
    this.router.navigate(['/admin/entrenamientos/dia', fecha]);
  }

  editarEntrenamiento(fecha: string): void {
    this.router.navigate(['/admin/entrenamientos/dia', fecha], { queryParams: { modo: 'editar' } });
  }

  confirmarEliminarEntrenamiento(fecha: string): void {
    this.errorEliminar.set('');
    this.pendingDeleteFecha.set(fecha);
  }

  cancelarEliminarEntrenamiento(): void {
    this.pendingDeleteFecha.set(null);
  }

  async eliminarEntrenamiento(): Promise<void> {
    const fecha = this.pendingDeleteFecha();
    if (!fecha) return;
    const dia = this.entrenamientos().find(e => e.fecha === fecha);
    if (!dia) return;

    this.eliminando.set(true);
    this.errorEliminar.set('');
    this.pendingDeleteFecha.set(null);
    try {
      for (const id of dia.ids) {
        await this.entrenamientoService.deleteEntrenamiento(id);
      }
      this.refresh$.next();
    } catch (err) {
      this.errorEliminar.set(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      this.eliminando.set(false);
    }
  }

  nuevaCompeticion(): void {
    this.router.navigate(['/admin/competiciones/nueva']);
  }

  totalPlatos(c: Competicion): number {
    return c.platosPorSerie * c.numSeries;
  }
}
