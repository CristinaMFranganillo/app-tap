import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ScoreService } from '../scores/score.service';
import { CompeticionService } from '../scores/competicion.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { Score } from '../../core/models/score.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [AvatarComponent, DatePipe, EmptyStateComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private scoreService = inject(ScoreService);
  private competicionService = inject(CompeticionService);
  private router = inject(Router);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  scores = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => this.scoreService.getByUser(u?.id ?? ''))
    ),
    { initialValue: [] as Score[] }
  );

  totalCompeticiones = computed(() => new Set(this.scores().map(s => s.competicionId)).size);

  mediaPlatos = computed(() => {
    const list = this.scores();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, s) => acc + s.platosRotos, 0);
    return Math.round(sum / list.length);
  });

  podios = computed(() =>
    this.scores().filter(s => s.platosRotos >= 20).length
  );

  getCompeticionNombre(competicionId: string): string {
    return this.competicionService.getById(competicionId)?.nombre ?? 'Competición';
  }

  getCompeticionTotal(competicionId: string): number {
    const c = this.competicionService.getById(competicionId);
    return c ? c.platosPorSerie * c.numSeries : 25;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
