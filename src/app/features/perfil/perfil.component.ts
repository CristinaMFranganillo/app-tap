import { Component, inject, computed, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, combineLatest } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ScoreService } from '../scores/score.service';
import { CompeticionService } from '../scores/competicion.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { AvatarEditorComponent } from '../../shared/components/avatar-editor/avatar-editor.component';
import { Score } from '../../core/models/score.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [AvatarComponent, AvatarEditorComponent, DatePipe, EmptyStateComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private scoreService = inject(ScoreService);
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  mostrarEditorAvatar = signal(false);

  abrirEditorAvatar(): void {
    this.mostrarEditorAvatar.set(true);
  }

  onAvatarCompletado(): void {
    this.mostrarEditorAvatar.set(false);
  }

  onAvatarOmitido(): void {
    this.mostrarEditorAvatar.set(false);
  }

  // ── Año seleccionado ───────────────────────────────────────────
  anioActual = new Date().getFullYear();
  anioSeleccionado = signal(this.anioActual);
  anios = Array.from({ length: 3 }, (_, i) => this.anioActual - i);

  // ── Competiciones (stats legacy) ──────────────────────────────
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

  podios = computed(() => this.scores().filter(s => s.platosRotos >= 20).length);

  getCompeticionNombre(competicionId: string): string {
    return this.competicionService.getById(competicionId)?.nombre ?? 'Competición';
  }

  getCompeticionTotal(competicionId: string): number {
    const c = this.competicionService.getById(competicionId);
    return c ? c.platosPorSerie * c.numSeries : 25;
  }

  // ── Entrenamientos del año ─────────────────────────────────────
  misEntrenamientos = toSignal(
    combineLatest([
      this.authService.currentUser$,
      toObservable(this.anioSeleccionado),
    ]).pipe(
      switchMap(([u, year]) =>
        this.entrenamientoService.getByUser(u?.id ?? '', year)
      )
    ),
    { initialValue: [] }
  );

  rankingAnual = toSignal(
    toObservable(this.anioSeleccionado).pipe(
      switchMap(year => this.entrenamientoService.getRankingAnual(year))
    ),
    { initialValue: [] }
  );

  totalEntrenamientos = computed(() => this.misEntrenamientos().length);

  mediaEntrenamientos = computed(() => {
    const list = this.misEntrenamientos();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, r) => acc + r.platosRotos, 0);
    return Math.round((sum / list.length) * 10) / 10;
  });

  mejorResultado = computed(() =>
    this.misEntrenamientos().reduce((max, r) => Math.max(max, r.platosRotos), 0)
  );

  posicionClub = computed(() => {
    const ranking = this.rankingAnual();
    const userId = this.user()?.id;
    if (!userId || ranking.length === 0) return null;
    const pos = ranking.findIndex(r => r.userId === userId);
    return pos === -1 ? null : { posicion: pos + 1, total: ranking.length };
  });

  mediaClub = computed(() => {
    const ranking = this.rankingAnual();
    if (ranking.length === 0) return 0;
    const sum = ranking.reduce((acc, r) => acc + r.mediaPlatos, 0);
    return Math.round((sum / ranking.length) * 10) / 10;
  });

  puntosSvg = computed(() => {
    const list = [...this.misEntrenamientos()].reverse();
    if (list.length < 2) return { points: '', dots: [] as { x: number; y: number; platos: number }[] };
    const W = 300;
    const H = 80;
    const PAD = 8;
    const xs = list.map((_, i) => PAD + (i / (list.length - 1)) * (W - PAD * 2));
    const ys = list.map(r => H - PAD - ((r.platosRotos / 25) * (H - PAD * 2)));
    const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
    const dots = xs.map((x, i) => ({ x, y: ys[i], platos: list[i].platosRotos }));
    return { points, dots };
  });

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
