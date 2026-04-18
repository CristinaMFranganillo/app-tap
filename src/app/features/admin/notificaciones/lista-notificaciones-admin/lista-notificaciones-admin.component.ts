import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NotificacionesAdminService } from '../notificaciones-admin.service';
import { Notificacion } from '../../../../core/models/notificacion.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-lista-notificaciones-admin',
  standalone: true,
  imports: [DatePipe, ConfirmDialogComponent],
  templateUrl: './lista-notificaciones-admin.component.html',
  styleUrl: './lista-notificaciones-admin.component.scss',
})
export class ListaNotificacionesAdminComponent implements OnInit {
  private service = inject(NotificacionesAdminService);
  private router = inject(Router);

  notificaciones = signal<Notificacion[]>([]);
  pendingDeleteId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.notificaciones.set(await this.service.getAll());
  }

  nueva(): void {
    this.router.navigate(['/admin/notificaciones/nueva']);
  }

  editar(id: string): void {
    this.router.navigate(['/admin/notificaciones', id]);
  }

  confirmarEliminar(id: string): void {
    this.pendingDeleteId.set(id);
  }

  async eliminar(): Promise<void> {
    const id = this.pendingDeleteId();
    if (!id) return;
    await this.service.eliminar(id);
    this.pendingDeleteId.set(null);
    await this.cargar();
  }

  cancelarEliminar(): void {
    this.pendingDeleteId.set(null);
  }

  labelDestinatarios(n: Notificacion): string {
    if (!n.destinatarios) return 'Todos';
    return `${n.destinatarios.length} socio${n.destinatarios.length !== 1 ? 's' : ''}`;
  }

  badgeClass(tipo: string): string {
    const mapa: Record<string, string> = {
      torneo:    'badge--torneo',
      cuota:     'badge--cuota',
      aviso:     'badge--aviso',
      resultado: 'badge--resultado',
      otro:      'badge--otro',
    };
    return mapa[tipo] ?? 'badge--otro';
  }
}
