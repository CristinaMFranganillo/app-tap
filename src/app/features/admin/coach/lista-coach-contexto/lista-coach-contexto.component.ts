import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { DatePipe } from '@angular/common';
import { CoachContextoService } from '../coach-contexto.service';
import { CoachContexto } from '../../../../core/models/coach.model';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-lista-coach-contexto',
  standalone: true,
  imports: [DatePipe, ConfirmDialogComponent],
  templateUrl: './lista-coach-contexto.component.html',
  styleUrl: './lista-coach-contexto.component.scss',
})
export class ListaCoachContextoComponent {
  private service = inject(CoachContextoService);
  private router  = inject(Router);

  private refresh$ = new Subject<void>();
  pendingDeleteId  = signal<string | null>(null);

  entradas = toSignal(
    this.refresh$.pipe(
      startWith(null),
      switchMap(() => this.service.getAll())
    ),
    { initialValue: [] as CoachContexto[] }
  );

  nueva(): void {
    this.router.navigate(['/admin/coach/nueva']);
  }

  editar(id: string): void {
    this.router.navigate(['/admin/coach', id]);
  }

  confirmarEliminar(id: string): void {
    this.pendingDeleteId.set(id);
  }

  async eliminar(): Promise<void> {
    const id = this.pendingDeleteId();
    if (!id) return;
    this.pendingDeleteId.set(null);
    await this.service.eliminar(id);
    this.refresh$.next();
  }

  cancelarEliminar(): void {
    this.pendingDeleteId.set(null);
  }

  async toggleActivo(entrada: CoachContexto): Promise<void> {
    await this.service.actualizar(entrada.id, { activo: !entrada.activo });
    this.refresh$.next();
  }

  badgeClase(categoria: CoachContexto['categoria']): string {
    const map: Record<string, string> = {
      noticia:        'badge-azul',
      consejo_tecnico:'badge-verde',
      aviso_torneo:   'badge-amber',
      equipamiento:   'badge-morado',
    };
    return map[categoria] ?? '';
  }

  badgeLabel(categoria: CoachContexto['categoria']): string {
    const map: Record<string, string> = {
      noticia:        'Noticia',
      consejo_tecnico:'Consejo técnico',
      aviso_torneo:   'Aviso torneo',
      equipamiento:   'Equipamiento',
    };
    return map[categoria] ?? categoria;
  }
}
