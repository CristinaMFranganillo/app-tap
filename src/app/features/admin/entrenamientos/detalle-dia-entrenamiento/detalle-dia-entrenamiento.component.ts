import { Component, inject, signal, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, startWith, Subject, firstValueFrom } from 'rxjs';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { Entrenamiento, ResultadoEntrenamiento } from '../../../../core/models/entrenamiento.model';
import { Escuadra } from '../../../../core/models/escuadra.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

interface FilaResultado {
  puesto: number;
  nombre: string;
  esNoSocio: boolean;
  platosRotos: number;
}

interface EscuadraConResultados {
  escuadra: Escuadra;
  entrenamientoId: string;
  filas: FilaResultado[];
  total: number;
  cargando: boolean;
}

@Component({
  selector: 'app-detalle-dia-entrenamiento',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, EmptyStateComponent, ConfirmDialogComponent],
  templateUrl: './detalle-dia-entrenamiento.component.html',
  styleUrl: './detalle-dia-entrenamiento.component.scss',
})
export class DetalleDiaEntrenamientoComponent {
  private route                = inject(ActivatedRoute);
  private router               = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService      = inject(EscuadraService);
  private userService          = inject(UserService);

  fecha       = this.route.snapshot.paramMap.get('fecha')!;
  modoEdicion = this.route.snapshot.queryParamMap.get('modo') === 'editar';

  private refresh$ = new Subject<void>();

  private entrenamientosDelDia = toSignal(
    this.refresh$.pipe(
      startWith(null),
      switchMap(() => this.entrenamientoService.getByFecha(this.fecha))
    ),
    { initialValue: [] as Entrenamiento[] }
  );

  escuadrasConResultados   = signal<EscuadraConResultados[]>([]);
  pendingDeleteEscuadraId  = signal<string | null>(null);
  eliminando               = signal(false);
  errorEliminar            = signal('');

  constructor() {
    effect(async () => {
      const entrenamientos = this.entrenamientosDelDia();
      if (entrenamientos.length === 0) {
        this.escuadrasConResultados.set([]);
        return;
      }

      const escuadrasPorEntrenamiento = await Promise.all(
        entrenamientos.map(e =>
          firstValueFrom(this.escuadraService.getByEntrenamiento(e.id))
            .then(escuadras => escuadras.map(esc => ({ ...esc, entrenamientoId: e.id })))
        )
      );
      const todasEscuadras = escuadrasPorEntrenamiento.flat();
      if (todasEscuadras.length === 0) { this.escuadrasConResultados.set([]); return; }

      this.escuadrasConResultados.set(
        todasEscuadras.map(e => ({
          escuadra: e, entrenamientoId: e.entrenamientoId,
          filas: [], total: 0, cargando: true,
        }))
      );

      const socios    = await firstValueFrom(this.userService.getAll());
      const resultados = await Promise.all(
        todasEscuadras.map(e =>
          firstValueFrom(this.entrenamientoService.getResultadosByEscuadra(e.id))
        )
      );

      this.escuadrasConResultados.set(
        todasEscuadras.map((e, i) => {
          const filas: FilaResultado[] = (resultados[i] as ResultadoEntrenamiento[])
            .map(r => ({
              puesto:      r.puesto,
              esNoSocio:   r.esNoSocio,
              nombre:      r.esNoSocio
                ? (r.nombreExterno ?? 'No socio')
                : (socios.find(s => s.id === r.userId)
                    ? `${socios.find(s => s.id === r.userId)!.nombre} ${socios.find(s => s.id === r.userId)!.apellidos}`
                    : (r.userId ?? '—')),
              platosRotos: r.platosRotos,
            }))
            .sort((a, b) => a.puesto - b.puesto);

          return {
            escuadra: e, entrenamientoId: e.entrenamientoId,
            filas, total: filas.reduce((s, f) => s + f.platosRotos, 0),
            cargando: false,
          };
        })
      );
    });
  }

  irResultados(entrenamientoId: string, escuadraId: string): void {
    this.router.navigate(
      ['/admin/entrenamientos', entrenamientoId, 'escuadra', escuadraId, 'resultados'],
      { queryParams: { fecha: this.fecha } }
    );
  }

  nuevaEscuadra(): void {
    const primero = this.entrenamientosDelDia()[0];
    if (primero) this.router.navigate(['/admin/entrenamientos', primero.id, 'escuadra', 'nueva']);
  }

  confirmarEliminarEscuadra(id: string): void { this.errorEliminar.set(''); this.pendingDeleteEscuadraId.set(id); }
  cancelarEliminarEscuadra(): void { this.pendingDeleteEscuadraId.set(null); }

  async eliminarEscuadra(): Promise<void> {
    const id = this.pendingDeleteEscuadraId();
    if (!id) return;
    this.eliminando.set(true);
    this.errorEliminar.set('');
    this.pendingDeleteEscuadraId.set(null);
    try {
      await this.escuadraService.deleteEscuadraEntrenamiento(id);
      this.refresh$.next();
    } catch (err) {
      this.errorEliminar.set(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      this.eliminando.set(false);
    }
  }

  goBack(): void { this.router.navigate(['/admin/scores']); }
}
