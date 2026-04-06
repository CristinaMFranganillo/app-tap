import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { News } from '../../core/models/news.model';

const MOCK_NEWS: News[] = [
  {
    id: '1',
    titulo: 'Campeonato Provincial de Foso Olímpico 2026',
    contenido: 'El próximo 15 de mayo celebramos el Campeonato Provincial de Foso Olímpico. La inscripción estará abierta hasta el 30 de abril. No te quedes sin tu plaza, el aforo es limitado. Este año contaremos con la participación de clubes de toda la provincia y esperamos batir el récord de participantes del año pasado.',
    autorId: '1',
    fecha: new Date('2026-04-01'),
    imagenUrl: undefined,
    publicada: true,
  },
  {
    id: '2',
    titulo: 'Nuevas instalaciones en el campo de tiro',
    contenido: 'Hemos renovado las instalaciones del campo con nuevas torres de lanzamiento y sistemas de control automático. Las mejoras estarán disponibles a partir del próximo mes para todos los socios.',
    autorId: '2',
    fecha: new Date('2026-03-20'),
    imagenUrl: undefined,
    publicada: true,
  },
  {
    id: '3',
    titulo: 'Taller de iniciación al tiro deportivo',
    contenido: 'Organizamos un taller de iniciación para socios nuevos y familiares. El taller incluye teoría básica, normas de seguridad y práctica guiada. Plazas limitadas.',
    autorId: '2',
    fecha: new Date('2026-03-10'),
    imagenUrl: undefined,
    publicada: true,
  },
  {
    id: '4',
    titulo: 'Borrador: Actualización reglamento interno',
    contenido: 'Revisión del reglamento interno del club para adaptarlo a la nueva normativa autonómica.',
    autorId: '1',
    fecha: new Date('2026-04-05'),
    imagenUrl: undefined,
    publicada: false,
  },
];

@Injectable({ providedIn: 'root' })
export class NewsService {
  private newsSubject = new BehaviorSubject<News[]>(MOCK_NEWS);
  readonly news$ = this.newsSubject.asObservable();

  getAll(): Observable<News[]> {
    return this.news$;
  }

  getPublicadas(): Observable<News[]> {
    return this.news$.pipe(
      map(news => news.filter(n => n.publicada).sort((a, b) => +b.fecha - +a.fecha))
    );
  }

  getById(id: string): News | undefined {
    return this.newsSubject.getValue().find(n => n.id === id);
  }

  create(data: Omit<News, 'id'>): void {
    const current = this.newsSubject.getValue();
    const newItem: News = { ...data, id: Date.now().toString() };
    this.newsSubject.next([newItem, ...current]);
  }

  update(id: string, data: Partial<News>): void {
    const current = this.newsSubject.getValue();
    this.newsSubject.next(current.map(n => n.id === id ? { ...n, ...data } : n));
  }

  delete(id: string): void {
    this.newsSubject.next(this.newsSubject.getValue().filter(n => n.id !== id));
  }
}
