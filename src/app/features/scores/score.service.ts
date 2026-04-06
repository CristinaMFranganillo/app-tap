import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Score } from '../../core/models/score.model';

const MOCK_SCORES: Score[] = [
  { id: '1', userId: '3', competicionId: '2', platosRotos: 22, fecha: new Date('2026-03-01'), registradoPor: '2' },
  { id: '2', userId: '4', competicionId: '2', platosRotos: 20, fecha: new Date('2026-03-01'), registradoPor: '2' },
  { id: '3', userId: '1', competicionId: '2', platosRotos: 24, fecha: new Date('2026-03-01'), registradoPor: '2' },
  { id: '4', userId: '3', competicionId: '3', platosRotos: 12, fecha: new Date('2026-03-15'), registradoPor: '2' },
  { id: '5', userId: '4', competicionId: '3', platosRotos: 14, fecha: new Date('2026-03-15'), registradoPor: '2' },
  { id: '6', userId: '1', competicionId: '3', platosRotos: 13, fecha: new Date('2026-03-15'), registradoPor: '2' },
];

export interface RankingEntry {
  userId: string;
  platosRotos: number;
  posicion: number;
}

@Injectable({ providedIn: 'root' })
export class ScoreService {
  private subject = new BehaviorSubject<Score[]>(MOCK_SCORES);
  readonly scores$ = this.subject.asObservable();

  getByCompeticion(competicionId: string): Observable<Score[]> {
    return this.scores$.pipe(
      map(scores => scores.filter(s => s.competicionId === competicionId))
    );
  }

  getByUser(userId: string): Observable<Score[]> {
    return this.scores$.pipe(
      map(scores => scores.filter(s => s.userId === userId).sort((a, b) => +b.fecha - +a.fecha))
    );
  }

  getRanking(competicionId: string): Observable<RankingEntry[]> {
    return this.getByCompeticion(competicionId).pipe(
      map(scores => {
        const sorted = [...scores].sort((a, b) => b.platosRotos - a.platosRotos);
        return sorted.map((s, i) => ({
          userId: s.userId,
          platosRotos: s.platosRotos,
          posicion: i + 1,
        }));
      })
    );
  }

  create(data: Omit<Score, 'id'>): void {
    const current = this.subject.getValue();
    const newScore: Score = { ...data, id: Date.now().toString() };
    this.subject.next([...current, newScore]);
  }
}
