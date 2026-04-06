import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, switchMap, startWith } from 'rxjs';
import { DatePipe } from '@angular/common';
import { NewsService } from '../../../noticias/news.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { News } from '../../../../core/models/news.model';

@Component({
  selector: 'app-lista-noticias-admin',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './lista-noticias-admin.component.html',
})
export class ListaNoticiasAdminComponent {
  private newsService = inject(NewsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private refresh$ = new Subject<void>();

  currentUserId = this.authService.currentUser?.id;
  isAdmin = this.authService.hasRole(['admin']);

  canEdit(noticia: News): boolean {
    return this.isAdmin || noticia.autorId === this.currentUserId;
  }

  noticias = toSignal(
    this.refresh$.pipe(
      startWith(null),
      switchMap(() => this.newsService.getAll())
    ),
    { initialValue: [] as News[] }
  );

  publicadas = () => this.noticias().filter(n => n.publicada);
  borradores = () => this.noticias().filter(n => !n.publicada);

  editar(id: string): void {
    this.router.navigate(['/admin/noticias', id, 'editar']);
  }

  crear(): void {
    this.router.navigate(['/admin/noticias/nueva']);
  }

  async eliminar(id: string): Promise<void> {
    await this.newsService.delete(id);
    this.refresh$.next();
  }

  async togglePublicada(noticia: News): Promise<void> {
    await this.newsService.update(noticia.id, { publicada: !noticia.publicada });
    this.refresh$.next();
  }
}
