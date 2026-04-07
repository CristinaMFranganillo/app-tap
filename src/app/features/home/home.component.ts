import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NewsService } from '../noticias/news.service';
import { AuthService } from '../../core/auth/auth.service';
import { CardNoticiaComponent } from '../../shared/components/card-noticia/card-noticia.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CardNoticiaComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private newsService = inject(NewsService);
  private authService = inject(AuthService);
  private router = inject(Router);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  ultimasNoticias = toSignal(
    this.newsService.getPublicadas().pipe(map(news => news.slice(0, 3))),
    { initialValue: [] }
  );

  goToNoticia(id: string): void {
    this.router.navigate(['/noticias', id]);
  }
}
