import { Component, inject, signal, OnInit } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ScoreService, RankingEntry } from '../score.service';
import { CompeticionService } from '../competicion.service';
import { UserService } from '../../admin/socios/user.service';
import { Competicion } from '../../../core/models/competicion.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-scores-ranking',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './scores-ranking.component.html',
})
export class ScoresRankingComponent implements OnInit {
  private competicionService = inject(CompeticionService);
  private scoreService = inject(ScoreService);
  private userService = inject(UserService);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  selectedId = signal<string>('');

  ranking = toSignal(
    toObservable(this.selectedId).pipe(
      switchMap(id => this.scoreService.getRanking(id))
    ),
    { initialValue: [] as RankingEntry[] }
  );

  ngOnInit(): void {
    const comps = this.competiciones();
    if (comps.length > 0) {
      this.selectedId.set(comps[0].id);
    }
  }

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
