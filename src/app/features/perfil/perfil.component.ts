import { Component, inject, computed, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, combineLatest, of } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { UserService } from '../admin/socios/user.service';
import { Entrenamiento } from '../../core/models/entrenamiento.model';
import { User } from '../../core/models/user.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { AvatarEditorComponent } from '../../shared/components/avatar-editor/avatar-editor.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [AvatarComponent, AvatarEditorComponent, EmptyStateComponent, DatePipe],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  mostrarEditorAvatar = signal(false);

  abrirEditorAvatar(): void { this.mostrarEditorAvatar.set(true); }
  onAvatarCompletado(): void { this.mostrarEditorAvatar.set(false); }
  onAvatarOmitido(): void { this.mostrarEditorAvatar.set(false); }

  // ── Año seleccionado ───────────────────────────────────────────
  anioActual = new Date().getFullYear();
  anioSeleccionado = signal(this.anioActual);
  anios = Array.from({ length: 3 }, (_, i) => this.anioActual - i);

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

  private userService = inject(UserService);

  // ── Bifurcación por rol ────────────────────────────────────────
  esAdmin = computed(() => {
    const rol = this.user()?.rol;
    return rol === 'admin' || rol === 'moderador';
  });

  // ── Datos del club (solo admin) ────────────────────────────────
  private todosLosSocios = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => u && (u.rol === 'admin' || u.rol === 'moderador')
        ? this.userService.getAll()
        : of([] as User[])
      )
    ),
    { initialValue: [] as User[] }
  );

  private todosLosEntrenamientos = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => u && (u.rol === 'admin' || u.rol === 'moderador')
        ? this.entrenamientoService.getAll()
        : of([] as Entrenamiento[])
      )
    ),
    { initialValue: [] as Entrenamiento[] }
  );

  sociosActivos = computed(() =>
    this.todosLosSocios().filter(s => s.activo)
  );

  totalActivos = computed(() => this.sociosActivos().length);

  cuotaPct = computed(() => {
    const activos = this.sociosActivos();
    if (activos.length === 0) return null;
    if (activos.every(s => s.cuotaPagada === undefined)) return null;
    const pagados = activos.filter(s => s.cuotaPagada === true).length;
    return Math.round((pagados / activos.length) * 100);
  });

  entrenamientosMes = computed(() => {
    const hoy = new Date();
    return this.todosLosEntrenamientos().filter(e => {
      const d = new Date(e.fecha);
      return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
    }).length;
  });

  ultimos5 = computed(() =>
    this.todosLosEntrenamientos().slice(0, 5)
  );

  irSocios(): void {
    this.router.navigate(['/admin/socios']);
  }

  irTemporadas(): void {
    this.router.navigate(['/admin/temporadas']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
