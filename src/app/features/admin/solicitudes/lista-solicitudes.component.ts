import { Component, inject, signal, computed } from '@angular/core';
import { Subject, switchMap, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SolicitudService } from '../../registro/solicitud.service';
import { SolicitudRegistro } from '../../../core/models/solicitud.model';

type Tab = 'pendientes' | 'aceptadas' | 'rechazadas';

@Component({
  selector: 'app-lista-solicitudes',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './lista-solicitudes.component.html',
})
export class ListaSolicitudesComponent {
  private solicitudService = inject(SolicitudService);

  private refresh$ = new Subject<void>();

  private todas = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.solicitudService.getAll())),
    { initialValue: [] as SolicitudRegistro[] }
  );

  tabActiva = signal<Tab>('pendientes');

  pendientes = computed(() => this.todas().filter(s => s.estado === 'pendiente'));
  aceptadas  = computed(() => this.todas().filter(s => s.estado === 'aceptada'));
  rechazadas = computed(() => this.todas().filter(s => s.estado === 'rechazada'));

  // Estado modales
  modalAceptar: SolicitudRegistro | null = null;
  modalRechazar: SolicitudRegistro | null = null;

  // Campos modales
  numeroSocio = '';
  rolSeleccionado = 'socio';
  motivoRechazo = '';

  // Estados de carga/error
  loadingAccion = false;
  errorAccion = '';

  setTab(tab: Tab): void {
    this.tabActiva.set(tab);
  }

  abrirModalAceptar(solicitud: SolicitudRegistro): void {
    this.modalAceptar = solicitud;
    this.numeroSocio = '';
    this.rolSeleccionado = 'socio';
    this.errorAccion = '';
  }

  abrirModalRechazar(solicitud: SolicitudRegistro): void {
    this.modalRechazar = solicitud;
    this.motivoRechazo = '';
    this.errorAccion = '';
  }

  cerrarModales(): void {
    this.modalAceptar = null;
    this.modalRechazar = null;
    this.errorAccion = '';
    this.loadingAccion = false;
  }

  async confirmarAceptar(): Promise<void> {
    if (!this.modalAceptar || !this.numeroSocio.trim()) return;
    this.loadingAccion = true;
    this.errorAccion = '';
    try {
      await this.solicitudService.aceptar(this.modalAceptar.id, this.numeroSocio.trim(), this.rolSeleccionado);
      this.cerrarModales();
      this.refresh$.next();
    } catch (err: unknown) {
      this.errorAccion = err instanceof Error ? err.message : 'Error al aceptar.';
    } finally {
      this.loadingAccion = false;
    }
  }

  async confirmarRechazar(): Promise<void> {
    if (!this.modalRechazar) return;
    this.loadingAccion = true;
    this.errorAccion = '';
    try {
      await this.solicitudService.rechazar(this.modalRechazar.id, this.motivoRechazo || undefined);
      this.cerrarModales();
      this.refresh$.next();
    } catch (err: unknown) {
      this.errorAccion = err instanceof Error ? err.message : 'Error al rechazar.';
    } finally {
      this.loadingAccion = false;
    }
  }
}
