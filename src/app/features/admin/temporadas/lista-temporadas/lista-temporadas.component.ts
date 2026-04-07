import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { CuotaService } from '../../socios/cuota.service';

@Component({
  selector: 'app-lista-temporadas',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './lista-temporadas.component.html',
  styleUrl: './lista-temporadas.component.scss',
})
export class ListaTemporadasComponent {
  private cuotaService = inject(CuotaService);

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
    this.saving.set(true);
    this.error.set('');
    try {
      await this.cuotaService.crearTemporada(
        this.nuevoNombre(),
        new Date(this.nuevaFechaInicio())
      );
      this.mostrarFormulario.set(false);
      this.refresh$.next();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al crear la temporada.');
    } finally {
      this.saving.set(false);
    }
  }
}
