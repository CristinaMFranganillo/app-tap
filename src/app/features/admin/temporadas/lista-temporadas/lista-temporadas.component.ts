import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { CuotaService } from '../../socios/cuota.service';
import { UserService } from '../../socios/user.service';
import { Temporada } from '../../../../core/models/cuota.model';

@Component({
  selector: 'app-lista-temporadas',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './lista-temporadas.component.html',
  styleUrl: './lista-temporadas.component.scss',
})
export class ListaTemporadasComponent {
  private cuotaService = inject(CuotaService);
  private userService = inject(UserService);

  private refresh$ = new Subject<void>();
  temporadas = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.cuotaService.getTodasTemporadas())),
    { initialValue: [] }
  );

  mostrarFormulario = signal(false);
  saving = signal(false);
  error = signal('');

  // Campos del formulario nueva temporada
  nuevoNombre = signal('');
  nuevaFechaInicio = signal('');

  // Edición
  editandoTemporada = signal<Temporada | null>(null);
  editNombre = signal('');
  editFechaInicio = signal('');
  editSaving = signal(false);
  editError = signal('');

  // Confirmación eliminar temporada
  pendingDeleteTemporadaId = signal<string | null>(null);

  // Detalle socios pendientes (al pulsar en temporada)
  temporadaDetalle = signal<Temporada | null>(null);
  sociosPendientes = signal<{ id: string; nombre: string; apellidos: string }[]>([]);
  loadingPendientes = signal(false);

  // Modal socios sin pagar al crear nueva temporada
  sociosSinPagarAnterior = signal<{ id: string; nombre: string; apellidos: string }[]>([]);
  mostrarModalSinPagar = signal(false);

  abrirFormulario(): void {
    // Sugerir nombre automático basado en el año actual
    const hoy = new Date();
    const year = hoy.getMonth() >= 3 ? hoy.getFullYear() : hoy.getFullYear() - 1;
    this.nuevoNombre.set(`${year}-${year + 1}`);
    this.nuevaFechaInicio.set('');
    this.error.set('');
    this.mostrarFormulario.set(true);
  }

  cerrarFormulario(): void {
    this.mostrarFormulario.set(false);
  }

  async crearTemporada(): Promise<void> {
    if (!this.nuevoNombre() || !this.nuevaFechaInicio()) {
      this.error.set('El nombre y la fecha de inicio son obligatorios.');
      return;
    }

    const temporadaActual = this.temporadas().find(t => t.activa) ?? null;

    this.saving.set(true);
    this.error.set('');
    try {
      if (temporadaActual) {
        const pendientes = await new Promise<{ id: string; nombre: string; apellidos: string }[]>((resolve) => {
          this.cuotaService.getSociosPendientesByTemporada(temporadaActual.id).subscribe({
            next: resolve,
            error: () => resolve([]),
          });
        });
        if (pendientes.length > 0) {
          this.sociosSinPagarAnterior.set(pendientes);
          this.mostrarModalSinPagar.set(true);
          this.saving.set(false);
          return;
        }
      }

      await this._ejecutarCrearTemporada();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al crear la temporada.');
      this.saving.set(false);
    }
  }

  async _ejecutarCrearTemporada(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      await this.cuotaService.crearTemporada(
        this.nuevoNombre(),
        new Date(this.nuevaFechaInicio())
      );
      this.mostrarFormulario.set(false);
      this.mostrarModalSinPagar.set(false);
      this.refresh$.next();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al crear la temporada.');
    } finally {
      this.saving.set(false);
    }
  }

  abrirDetalle(temporada: Temporada): void {
    this.temporadaDetalle.set(temporada);
    this.sociosPendientes.set([]);
    this.loadingPendientes.set(true);
    this.cuotaService.getSociosPendientesByTemporada(temporada.id).subscribe({
      next: (socios) => {
        this.sociosPendientes.set(socios);
        this.loadingPendientes.set(false);
      },
      error: () => this.loadingPendientes.set(false),
    });
  }

  cerrarDetalle(): void {
    this.temporadaDetalle.set(null);
  }

  abrirEdicion(temporada: Temporada, event: Event): void {
    event.stopPropagation();
    this.editandoTemporada.set(temporada);
    this.editNombre.set(temporada.nombre);
    const yyyy = temporada.fechaInicio.toISOString().split('T')[0];
    this.editFechaInicio.set(yyyy);
    this.editError.set('');
  }

  cerrarEdicion(): void {
    this.editandoTemporada.set(null);
  }

  async guardarEdicion(): Promise<void> {
    const t = this.editandoTemporada();
    if (!t) return;
    if (!this.editNombre() || !this.editFechaInicio()) {
      this.editError.set('El nombre y la fecha son obligatorios.');
      return;
    }
    this.editSaving.set(true);
    this.editError.set('');
    try {
      await this.cuotaService.editarTemporada(t.id, this.editNombre(), new Date(this.editFechaInicio()));
      this.editandoTemporada.set(null);
      this.refresh$.next();
    } catch (err: unknown) {
      this.editError.set(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      this.editSaving.set(false);
    }
  }

  confirmarEliminarTemporada(id: string, event: Event): void {
    event.stopPropagation();
    this.pendingDeleteTemporadaId.set(id);
  }

  cancelarEliminarTemporada(): void {
    this.pendingDeleteTemporadaId.set(null);
  }

  async eliminarTemporada(): Promise<void> {
    const id = this.pendingDeleteTemporadaId();
    if (!id) return;
    this.pendingDeleteTemporadaId.set(null);
    try {
      await this.cuotaService.eliminarTemporada(id);
      this.refresh$.next();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  }

  cerrarModalSinPagar(): void {
    this.mostrarModalSinPagar.set(false);
    this.sociosSinPagarAnterior.set([]);
  }

  async darDeBajaSocio(id: string): Promise<void> {
    try {
      await this.userService.eliminar(id);
      this.sociosSinPagarAnterior.update(list => list.filter(s => s.id !== id));
    } catch {
      // silenciar — no bloquea el flujo principal
    }
  }
}
