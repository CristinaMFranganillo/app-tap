import { Component, inject, signal, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { Entrenamiento, ResultadoEntrenamiento } from '../../../../core/models/entrenamiento.model';
import { Escuadra } from '../../../../core/models/escuadra.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

export interface FilaResultado {
  puesto: number;
  nombre: string;
  platosRotos: number;
  fallos: number[];
}

export interface EscuadraConResultados {
  escuadra: Escuadra;
  filas: FilaResultado[];
  total: number;
  cargando: boolean;
}

@Component({
  selector: 'app-detalle-entrenamiento',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './detalle-entrenamiento.component.html',
  styleUrl: './detalle-entrenamiento.component.scss',
})
export class DetalleEntrenamientoComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);

  private id$ = this.route.paramMap.pipe(map(p => p.get('id')!));

  modoEdicion = this.route.snapshot.queryParamMap.get('modo') === 'editar';

  entrenamiento = toSignal<Entrenamiento | null>(
    this.id$.pipe(switchMap(id => this.entrenamientoService.getById(id))),
    { initialValue: null }
  );

  private escuadrasRaw = toSignal(
    this.id$.pipe(switchMap(id => this.escuadraService.getByEntrenamiento(id))),
    { initialValue: [] as Escuadra[] }
  );

  escuadrasConResultados = signal<EscuadraConResultados[]>([]);

  constructor() {
    effect(async () => {
      const escuadras = this.escuadrasRaw();
      if (escuadras.length === 0) {
        this.escuadrasConResultados.set([]);
        return;
      }

      // Inicializar con spinner por escuadra
      this.escuadrasConResultados.set(
        escuadras.map(e => ({ escuadra: e, filas: [], total: 0, cargando: true }))
      );

      const socios = await firstValueFrom(this.userService.getAll());

      const [resultados, fallosPorEscuadra] = await Promise.all([
        Promise.all(
          escuadras.map(e =>
            firstValueFrom(this.entrenamientoService.getResultadosByEscuadra(e.id))
          )
        ),
        Promise.all(
          escuadras.map(e =>
            firstValueFrom(this.entrenamientoService.getFallosByEscuadra(e.id))
          )
        ),
      ]);

      this.escuadrasConResultados.set(
        escuadras.map((e, i) => {
          const fallosMap = new Map<string, number[]>();
          for (const f of fallosPorEscuadra[i]) {
            if (!fallosMap.has(f.userId)) fallosMap.set(f.userId, []);
            fallosMap.get(f.userId)!.push(f.numeroPlato);
          }

          const filas: FilaResultado[] = (resultados[i] as ResultadoEntrenamiento[])
            .map(r => {
              const socio = socios.find(s => s.id === r.userId);
              return {
                puesto: r.puesto,
                nombre: socio ? `${socio.nombre} ${socio.apellidos}` : r.userId,
                platosRotos: r.platosRotos,
                fallos: (fallosMap.get(r.userId) ?? []).sort((a, b) => a - b),
              };
            })
            .sort((a, b) => a.puesto - b.puesto);

          return {
            escuadra: e,
            filas,
            total: filas.reduce((s, f) => s + f.platosRotos, 0),
            cargando: false,
          };
        })
      );
    });
  }

  nuevaEscuadra(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', id, 'escuadra', 'nueva']);
  }

  irResultados(escuadraId: string): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', id, 'escuadra', escuadraId, 'resultados']);
  }

  goBack(): void {
    this.router.navigate(['/admin/scores']);
  }
}
