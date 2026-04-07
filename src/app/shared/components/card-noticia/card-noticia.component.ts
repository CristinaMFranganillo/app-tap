import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { News } from '../../../core/models/news.model';

@Component({
  selector: 'app-card-noticia',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './card-noticia.component.html',
  styleUrl: './card-noticia.component.scss',
})
export class CardNoticiaComponent {
  @Input({ required: true }) noticia!: News;

  isReciente(fecha: Date): boolean {
    const hoy = new Date();
    const diff = hoy.getTime() - new Date(fecha).getTime();
    return diff < 1000 * 60 * 60 * 24 * 7;
  }
}
