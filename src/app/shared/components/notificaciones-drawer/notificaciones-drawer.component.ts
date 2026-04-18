import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { TipoNotificacion } from '../../../core/models/notificacion.model';

@Component({
  selector: 'app-notificaciones-drawer',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './notificaciones-drawer.component.html',
  styleUrl: './notificaciones-drawer.component.scss',
})
export class NotificacionesDrawerComponent {
  @Input() abierto = false;
  @Output() cerrar = new EventEmitter<void>();

  readonly notificacionesService = inject(NotificacionesService);

  onCerrar(): void {
    this.cerrar.emit();
  }

  async onMarcarLeida(id: string): Promise<void> {
    await this.notificacionesService.marcarLeida(id);
  }

  async onMarcarTodas(): Promise<void> {
    await this.notificacionesService.marcarTodasLeidas();
  }

  iconoPorTipo(tipo: TipoNotificacion): string {
    const mapa: Record<TipoNotificacion, string> = {
      torneo:    'bi-trophy-fill',
      cuota:     'bi-credit-card-fill',
      aviso:     'bi-exclamation-triangle-fill',
      resultado: 'bi-bullseye',
      otro:      'bi-info-circle-fill',
    };
    return mapa[tipo];
  }

  colorPorTipo(tipo: TipoNotificacion): string {
    const mapa: Record<TipoNotificacion, string> = {
      torneo:    '#FFAE00',
      cuota:     '#3B82F6',
      aviso:     '#F59E0B',
      resultado: '#10B981',
      otro:      '#6B7280',
    };
    return mapa[tipo];
  }

  fechaRelativa(createdAt: string): string {
    const ahora = Date.now();
    const fecha = new Date(createdAt).getTime();
    const diffMs = ahora - fecha;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 0) return 'Hoy';
    if (diffDias === 1) return 'Ayer';
    return `Hace ${diffDias} días`;
  }
}
