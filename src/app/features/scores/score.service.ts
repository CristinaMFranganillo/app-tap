import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Score } from '../../core/models/score.model';
import { supabase } from '../../core/supabase/supabase.client';

export interface RankingEntry {
  userId: string;
  platosRotos: number;
  posicion: number;
}

function toScore(row: Record<string, unknown>): Score {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    competicionId: row['competicion_id'] as string,
    platosRotos: row['platos_rotos'] as number,
    fecha: new Date(row['fecha'] as string),
    registradoPor: row['registrado_por'] as string,
  };
}

@Injectable({ providedIn: 'root' })
export class ScoreService {

  getByCompeticion(competicionId: string): Observable<Score[]> {
    return from(
      supabase.from('scores').select('*').eq('competicion_id', competicionId)
    ).pipe(map(({ data }) => (data ?? []).map(toScore)));
  }

  getByUser(userId: string): Observable<Score[]> {
    return from(
      supabase.from('scores').select('*').eq('user_id', userId).order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toScore)));
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

  async create(data: Omit<Score, 'id'>): Promise<void> {
    await supabase.from('scores').insert({
      user_id: data.userId,
      competicion_id: data.competicionId,
      platos_rotos: data.platosRotos,
      fecha: data.fecha.toISOString(),
      registrado_por: data.registradoPor,
    });
  }
}
