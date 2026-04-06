import { Component, inject, signal, computed } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ResultadoService } from '../resultado.service';
import { CompeticionService } from '../competicion.service';
import { UserService } from '../../admin/socios/user.service';
import { Competicion } from '../../../core/models/competicion.model';
import { ResumenTirador } from '../../../core/models/resultado.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-scores-ranking',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './scores-ranking.component.html',
})
export class ScoresRankingComponent {
  private competicionService = inject(CompeticionService);
  private resultadoService = inject(ResultadoService);
  private userService = inject(UserService);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  selectedId = signal<string>('');

  competicionActual = computed(() => this.competiciones().find(c => c.id === this.selectedId()));

  ranking = toSignal(
    toObservable(this.selectedId).pipe(
      switchMap(id => {
        const comp = this.competicionService.getById(id);
        const total = comp ? comp.platosPorSerie * comp.numSeries : 25;
        return this.resultadoService.getRanking(id, total);
      })
    ),
    { initialValue: [] as ResumenTirador[] }
  );

  selectCompeticion(id: string): void {
    this.selectedId.set(id);
  }

  getUserNombre(userId: string): string {
    const u = this.userService.getById(userId);
    return u ? `${u.nombre} ${u.apellidos}` : 'Desconocido';
  }

  getUserApellidos(userId: string): string {
    return this.userService.getById(userId)?.apellidos ?? '';
  }

  getMedalIcon(posicion: number): string {
    if (posicion === 1) return '🥇';
    if (posicion === 2) return '🥈';
    if (posicion === 3) return '🥉';
    return `${posicion}º`;
  }
}
