import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { TorneoService } from '../torneo.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Torneo } from '../../../../core/models/torneo.model';

@Component({
  selector: 'app-lista-torneos',
  standalone: true,
  imports: [FormsModule, DatePipe, ConfirmDialogComponent],
  templateUrl: './lista-torneos.component.html',
  styleUrl: './lista-torneos.component.scss',
})
export class ListaTorneosComponent {
  private torneoService = inject(TorneoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  private refresh$ = new Subject<void>();
  torneos = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.torneoService.getAll())),
    { initialValue: [] }
  );

  // Formulario crear
  mostrarFormulario = signal(false);
  saving = signal(false);
  error = signal('');
  nuevoNombre = signal('');
  nuevaFecha = signal('');

  // Edicion
  editandoTorneo = signal<Torneo | null>(null);
  editNombre = signal('');
  editFecha = signal('');
  editSaving = signal(false);
  editError = signal('');

  // Confirmacion eliminar
  pendingDeleteTorneoId = signal<string | null>(null);

  abrirFormulario(): void {
    this.nuevoNombre.set('');
    this.nuevaFecha.set('');
    this.error.set('');
    this.mostrarFormulario.set(true);
  }

  cerrarFormulario(): void {
    this.mostrarFormulario.set(false);
  }

  async crearTorneo(): Promise<void> {
    if (!this.nuevoNombre() || !this.nuevaFecha()) {
      this.error.set('El nombre y la fecha son obligatorios.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      const userId = this.authService.currentUser?.id;
      if (!userId) throw new Error('No se pudo obtener el usuario actual.');

      const id = await this.torneoService.create(this.nuevoNombre(), this.nuevaFecha(), userId);
      this.mostrarFormulario.set(false);
      this.router.navigate(['/admin/torneos', id]);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al crear el torneo.');
    } finally {
      this.saving.set(false);
    }
  }

  irADetalle(torneo: Torneo): void {
    this.router.navigate(['/admin/torneos', torneo.id]);
  }

  abrirEdicion(torneo: Torneo, event: Event): void {
    event.stopPropagation();
    this.editandoTorneo.set(torneo);
    this.editNombre.set(torneo.nombre);
    this.editFecha.set(torneo.fecha);
    this.editError.set('');
  }

  cerrarEdicion(): void {
    this.editandoTorneo.set(null);
  }

  async guardarEdicion(): Promise<void> {
    const t = this.editandoTorneo();
    if (!t) return;
    if (!this.editNombre() || !this.editFecha()) {
      this.editError.set('El nombre y la fecha son obligatorios.');
      return;
    }
    this.editSaving.set(true);
    this.editError.set('');
    try {
      await this.torneoService.update(t.id, this.editNombre(), this.editFecha());
      this.editandoTorneo.set(null);
      this.refresh$.next();
    } catch (err: unknown) {
      this.editError.set(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      this.editSaving.set(false);
    }
  }

  confirmarEliminarTorneo(id: string, event: Event): void {
    event.stopPropagation();
    this.pendingDeleteTorneoId.set(id);
  }

  cancelarEliminarTorneo(): void {
    this.pendingDeleteTorneoId.set(null);
  }

  async eliminarTorneo(): Promise<void> {
    const id = this.pendingDeleteTorneoId();
    if (!id) return;
    this.pendingDeleteTorneoId.set(null);
    try {
      await this.torneoService.deleteTorneo(id);
      this.refresh$.next();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  }
}
