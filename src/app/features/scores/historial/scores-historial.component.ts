import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, EMPTY } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ResultadoService } from '../resultado.service';
import { CompeticionService } from '../competicion.service';
import { AuthService } from '../../../core/auth/auth.service';
import { EntrenamientoService } from '../../admin/entrenamientos/entrenamiento.service';
import { Resultado } from '../../../core/models/resultado.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

interface ItemHistorial {
  tipo: 'entrenamiento' | 'competicion';
  fecha: Date;
  titulo: string;
  platosRotos: number;
  totalPlatos: number;
}

@Component({
  selector: 'app-scores-historial',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './scores-historial.component.html',
  styleUrl: './scores-historial.component.scss',
})
export class ScoresHistorialComponent {
  private auth = inject(AuthService);
  private resultadoService = inject(ResultadoService);
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);

  private anio = new Date().getFullYear();

  resultados = toSignal(
    this.auth.currentUser$.pipe(
      switchMap(user => user?.id ? this.resultadoService.getByUser(user.id) : EMPTY)
    ),
    { initialValue: [] as Resultado[] }
  );

  entrenamientos = toSignal(
    this.auth.currentUser$.pipe(
      switchMap(user =>
        user?.id ? this.entrenamientoService.getByUser(user.id, this.anio) : EMPTY
      )
    ),
    { initialValue: [] }
  );

  timeline = computed<ItemHistorial[]>(() => {
    const compMap = new Map<string, { rotos: number; total: number; fecha: Date }>();
    for (const r of this.resultados()) {
      const comp = this.competicionService.getById(r.competicionId);
      const total = comp ? comp.platosPorSerie * comp.numSeries : 25;
      if (!compMap.has(r.competicionId)) {
        compMap.set(r.competicionId, { rotos: 0, total, fecha: r.fecha });
      }
      compMap.get(r.competicionId)!.rotos += r.resultado;
    }
    const competicionItems: ItemHistorial[] = Array.from(compMap.entries()).map(
      ([competicionId, v]) => ({
        tipo: 'competicion' as const,
        fecha: v.fecha,
        titulo: this.competicionService.getById(competicionId)?.nombre ?? 'Competición',
        platosRotos: v.rotos,
        totalPlatos: v.total,
      })
    );

    const entrenamientoItems: ItemHistorial[] = this.entrenamientos().map(e => ({
      tipo: 'entrenamiento' as const,
      fecha: new Date(e.fecha),
      titulo: 'Entrenamiento',
      platosRotos: e.platosRotos,
      totalPlatos: 25,
    }));

    return [...competicionItems, ...entrenamientoItems].sort(
      (a, b) => b.fecha.getTime() - a.fecha.getTime()
    );
  });

  getPorcentaje(rotos: number, total: number): number {
    return total > 0 ? Math.round((rotos / total) * 100) : 0;
  }
}
