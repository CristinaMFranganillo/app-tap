import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ResultadoService } from '../resultado.service';
import { CompeticionService } from '../competicion.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Resultado } from '../../../core/models/resultado.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-scores-historial',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './scores-historial.component.html',
})
export class ScoresHistorialComponent {
  private auth = inject(AuthService);
  private resultadoService = inject(ResultadoService);
  private competicionService = inject(CompeticionService);

  resultados = toSignal(
    this.auth.currentUser$.pipe(
      switchMap(user => this.resultadoService.getByUser(user?.id ?? ''))
    ),
    { initialValue: [] as Resultado[] }
  );

  resumenPorCompeticion = computed(() => {
    const map = new Map<string, { rotos: number; total: number; fecha: Date }>();
    for (const r of this.resultados()) {
      const comp = this.competicionService.getById(r.competicionId);
      const total = comp ? comp.platosPorSerie * comp.numSeries : 25;
      if (!map.has(r.competicionId)) {
        map.set(r.competicionId, { rotos: 0, total, fecha: r.fecha });
      }
      map.get(r.competicionId)!.rotos += r.resultado;
    }
    return Array.from(map.entries()).map(([competicionId, v]) => ({ competicionId, ...v }));
  });

  getCompeticionNombre(competicionId: string): string {
    return this.competicionService.getById(competicionId)?.nombre ?? 'Competición';
  }

  getPorcentaje(rotos: number, total: number): number {
    return total > 0 ? Math.round((rotos / total) * 100) : 0;
  }
}
