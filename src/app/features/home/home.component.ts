import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { NewsService } from '../noticias/news.service';
import { AuthService } from '../../core/auth/auth.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { CardNoticiaComponent } from '../../shared/components/card-noticia/card-noticia.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CardNoticiaComponent, DatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private newsService = inject(NewsService);
  private authService = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  private anio = new Date().getFullYear();

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  ultimasNoticias = toSignal(
    this.newsService.getPublicadas().pipe(map(news => news.slice(0, 1))),
    { initialValue: [] }
  );

  private misEntrenamientos = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => this.entrenamientoService.getByUser(u?.id ?? '', this.anio))
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

  goToNoticia(id: string): void {
    this.router.navigate(['/noticias', id]);
  }

  goToPerfil(): void {
    this.router.navigate(['/perfil']);
  }
}
