import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NewsService } from '../news.service';
import { CardNoticiaComponent } from '../../../shared/components/card-noticia/card-noticia.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-lista-noticias',
  standalone: true,
  imports: [CardNoticiaComponent, EmptyStateComponent],
  templateUrl: './lista-noticias.component.html',
})
export class ListaNoticiasComponent {
  private newsService = inject(NewsService);
  private router = inject(Router);

  noticias = toSignal(this.newsService.getPublicadas(), { initialValue: [] });

  goToDetalle(id: string): void {
    this.router.navigate(['/noticias', id]);
  }
}
