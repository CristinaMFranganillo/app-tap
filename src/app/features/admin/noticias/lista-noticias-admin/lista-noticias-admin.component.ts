import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NewsService } from '../../../noticias/news.service';
import { News } from '../../../../core/models/news.model';

@Component({
  selector: 'app-lista-noticias-admin',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './lista-noticias-admin.component.html',
})
export class ListaNoticiasAdminComponent {
  private newsService = inject(NewsService);
  private router = inject(Router);

  noticias = toSignal(this.newsService.getAll(), { initialValue: [] as News[] });

  publicadas = () => this.noticias().filter(n => n.publicada);
  borradores = () => this.noticias().filter(n => !n.publicada);

  editar(id: string): void {
    this.router.navigate(['/admin/noticias', id, 'editar']);
  }

  crear(): void {
    this.router.navigate(['/admin/noticias/nueva']);
  }

  eliminar(id: string): void {
    this.newsService.delete(id);
  }

  togglePublicada(noticia: News): void {
    this.newsService.update(noticia.id, { publicada: !noticia.publicada });
  }
}
