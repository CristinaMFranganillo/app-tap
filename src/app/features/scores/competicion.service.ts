import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Competicion } from '../../core/models/competicion.model';

const MOCK_COMPETICIONES: Competicion[] = [
  { id: '1', nombre: 'Campeonato Provincial 2026', modalidad: 'Foso Olímpico', totalPlatos: 25, fecha: new Date('2026-05-15'), activa: true, creadaPor: '1' },
  { id: '2', nombre: 'Copa Primavera 2026', modalidad: 'Skeet', totalPlatos: 25, fecha: new Date('2026-03-01'), activa: false, creadaPor: '1' },
  { id: '3', nombre: 'Entrenamiento Marzo', modalidad: 'Foso Universal', totalPlatos: 15, fecha: new Date('2026-03-15'), activa: false, creadaPor: '2' },
];

@Injectable({ providedIn: 'root' })
export class CompeticionService {
  private subject = new BehaviorSubject<Competicion[]>(MOCK_COMPETICIONES);
  readonly competiciones$ = this.subject.asObservable();

  getAll(): Observable<Competicion[]> {
    return this.competiciones$;
  }

  getActiva(): Observable<Competicion | undefined> {
    return this.competiciones$.pipe(
      map(list => list.find(c => c.activa))
    );
  }

  getById(id: string): Competicion | undefined {
    return this.subject.getValue().find(c => c.id === id);
  }

  create(data: Omit<Competicion, 'id'>): void {
    const current = this.subject.getValue();
    const newItem: Competicion = { ...data, id: Date.now().toString() };
    this.subject.next([...current, newItem]);
  }

  update(id: string, data: Partial<Competicion>): void {
    const current = this.subject.getValue();
    this.subject.next(current.map(c => c.id === id ? { ...c, ...data } : c));
  }
}
