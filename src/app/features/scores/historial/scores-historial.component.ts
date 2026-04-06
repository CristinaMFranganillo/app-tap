import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ScoreService } from '../score.service';
import { CompeticionService } from '../competicion.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Score } from '../../../core/models/score.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-scores-historial',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './scores-historial.component.html',
})
export class ScoresHistorialComponent {
  private authService = inject(AuthService);
  private scoreService = inject(ScoreService);
  private competicionService = inject(CompeticionService);

  scores = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(user => this.scoreService.getByUser(user?.id ?? ''))
    ),
    { initialValue: [] as Score[] }
  );

  getCompeticionNombre(competicionId: string): string {
    return this.competicionService.getById(competicionId)?.nombre ?? 'Competición';
  }

  getCompeticionTotal(competicionId: string): number {
    const c = this.competicionService.getById(competicionId);
    return c ? c.platosPorSerie * c.numSeries : 25;
  }

  getPorcentaje(platosRotos: number, competicionId: string): number {
    const total = this.getCompeticionTotal(competicionId);
    return total > 0 ? Math.round((platosRotos / total) * 100) : 0;
  }
}
