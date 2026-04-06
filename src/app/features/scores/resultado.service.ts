import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Resultado, ResumenTirador } from '../../core/models/resultado.model';
import { supabase } from '../../core/supabase/supabase.client';

function toResultado(row: Record<string, unknown>): Resultado {
  return {
    id: row['id'] as string,
    competicionId: row['competicion_id'] as string,
    userId: row['user_id'] as string,
    serie: row['serie'] as number,
    plato: row['plato'] as number,
    resultado: row['resultado'] as 0 | 1,
    registradoPor: (row['registrado_por'] as string) ?? undefined,
    fecha: new Date(row['fecha'] as string),
  };
}

@Injectable({ providedIn: 'root' })
export class ResultadoService {
  getByCompeticion(competicionId: string): Observable<Resultado[]> {
    return from(
      supabase
        .from('resultados')
        .select('*')
        .eq('competicion_id', competicionId)
        .order('serie')
        .order('plato')
    ).pipe(map(({ data }) => (data ?? []).map(toResultado)));
  }

  getByUser(userId: string): Observable<Resultado[]> {
    return from(
      supabase
        .from('resultados')
        .select('*')
        .eq('user_id', userId)
        .order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toResultado)));
  }

  getRanking(competicionId: string, totalPlatos: number): Observable<ResumenTirador[]> {
    return this.getByCompeticion(competicionId).pipe(
      map(resultados => {
        const byUser = new Map<string, Resultado[]>();
        for (const r of resultados) {
          if (!byUser.has(r.userId)) byUser.set(r.userId, []);
          byUser.get(r.userId)!.push(r);
        }
        return Array.from(byUser.entries())
          .map(([userId, lista]) => {
            const totalRotos = lista.reduce((s, r) => s + r.resultado, 0);
            const series = new Map<number, number>();
            for (const r of lista) {
              series.set(r.serie, (series.get(r.serie) ?? 0) + r.resultado);
            }
            return {
              userId,
              totalRotos,
              totalPlatos,
              porSerie: Array.from(series.entries()).map(([serie, rotos]) => ({ serie, rotos })),
            };
          })
          .sort((a, b) => b.totalRotos - a.totalRotos);
      })
    );
  }

  async upsert(data: Omit<Resultado, 'id' | 'fecha'>, registradoPorId: string): Promise<void> {
    const { error } = await supabase.from('resultados').upsert({
      competicion_id: data.competicionId,
      user_id: data.userId,
      serie: data.serie,
      plato: data.plato,
      resultado: data.resultado,
      registrado_por: registradoPorId,
    }, { onConflict: 'competicion_id,user_id,serie,plato' });
    if (error) throw new Error('Error guardando resultado');
  }
}
