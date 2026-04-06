import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NewsService } from '../news.service';
import { News } from '../../../core/models/news.model';

@Component({
  selector: 'app-detalle-noticia',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './detalle-noticia.component.html',
})
export class DetalleNoticiaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private newsService = inject(NewsService);

  noticia = signal<News | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const noticia = await this.newsService.getById(id);
      this.noticia.set(noticia);
    }
    if (!this.noticia()) {
      this.router.navigate(['/noticias']);
    }
  }

  goBack(): void {
    this.router.navigate(['/noticias']);
  }
}
