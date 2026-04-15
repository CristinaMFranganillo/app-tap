import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, EMPTY, of } from 'rxjs';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { NewsService } from '../noticias/news.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { UserService } from '../admin/socios/user.service';
import { Entrenamiento } from '../../core/models/entrenamiento.model';
import { User } from '../../core/models/user.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { CardNoticiaComponent } from '../../shared/components/card-noticia/card-noticia.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [EmptyStateComponent, DatePipe, CardNoticiaComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private newsService = inject(NewsService);
  private authService = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);
  private userService = inject(UserService);
  private router = inject(Router);

  private anio = new Date().getFullYear();

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  esAdmin = computed(() => {
    const rol = this.user()?.rol;
    return rol === 'admin' || rol === 'moderador';
  });

  noticias = toSignal(
    this.newsService.getPublicadas(),
    { initialValue: [] }
  );

  // ── Datos de socio ──────────────────────────────────────────────

  private misEntrenamientos = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => u?.id ? this.entrenamientoService.getByUser(u.id, this.anio) : EMPTY)
    ),
    { initialValue: [] }
  );

  private rankingAnual = toSignal(
    this.entrenamientoService.getRankingAnual(this.anio),
    { initialValue: [] }
  );

  ultimoEntrenamiento = computed(() => this.misEntrenamientos()[0] ?? null);

  mediaAnual = computed(() => {
    const list = this.misEntrenamientos();
    if (list.length === 0) return null;
    const sum = list.reduce((acc, r) => acc + r.platosRotos, 0);
    return Math.round((sum / list.length) * 10) / 10;
  });

  posicionClub = computed(() => {
    const ranking = this.rankingAnual();
    const userId = this.user()?.id;
    if (!userId || ranking.length === 0) return null;
    const pos = ranking.findIndex(r => r.userId === userId);
    return pos === -1 ? null : { posicion: pos + 1, total: ranking.length };
  });

  // ── Datos de admin ──────────────────────────────────────────────

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

  totalInactivos = computed(() =>
    this.todosLosSocios().filter(s => !s.activo).length
  );

  ultimos5 = computed(() =>
    this.todosLosEntrenamientos().slice(0, 5)
  );

  // ── Navegación ──────────────────────────────────────────────────

  goToNoticia(id: string): void {
    this.router.navigate(['/noticias', id]);
  }

  goToPerfil(): void {
    this.router.navigate(['/perfil']);
  }

  goToJuegos(): void {
    this.router.navigate(['/juegos']);
  }

  irSocios(): void {
    this.router.navigate(['/admin/socios']);
  }

  irTemporadas(): void {
    this.router.navigate(['/admin/temporadas']);
  }

  irEntrenamientos(): void {
    this.router.navigate(['/admin/scores']);
  }
}
