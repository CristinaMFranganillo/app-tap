import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NewsService } from '../noticias/news.service';
import { CardNoticiaComponent } from '../../shared/components/card-noticia/card-noticia.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CardNoticiaComponent],
  template: `
    <div class="p-3">
      <h2 class="text-[9px] font-extrabold uppercase tracking-[1.5px] text-brand-dark mb-3">Inicio</h2>

      <p class="text-[8px] font-bold text-gray-300 uppercase tracking-wider mb-2">Últimas noticias</p>

      @for (n of ultimasNoticias(); track n.id) {
        <button class="w-full text-left" (click)="goToNoticia(n.id)">
          <app-card-noticia [noticia]="n" />
        </button>
      }
    </div>
  `,
})
export class HomeComponent {
  private newsService = inject(NewsService);
  private router = inject(Router);

  ultimasNoticias = toSignal(
    this.newsService.getPublicadas().pipe(map(news => news.slice(0, 3))),
    { initialValue: [] }
  );

  goToNoticia(id: string): void {
    this.router.navigate(['/noticias', id]);
  }
}
