import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { supabase } from '../../core/supabase/supabase.client';

export interface RankingJuego {
  userId: string;
  nombre: string;
  apellidos: string;
  valor: number;
  aciertos: number | null;
}

const JUEGOS_ORDEN_ASCENDENTE = ['reflejos', 'lateralidad'];

function esMejorAscendente(tipoJuego: string): boolean {
  return JUEGOS_ORDEN_ASCENDENTE.includes(tipoJuego);
}

@Injectable({ providedIn: 'root' })
export class JuegosService {

  async guardarPartidaAsync(
    userId: string,
    tipoJuego: string,
    valor: number,
    aciertos: number | null,
    totalRondas: number
  ): Promise<void> {
    await supabase.from('juegos_scores').insert({
      user_id: userId,
      tipo_juego: tipoJuego,
      valor,
      aciertos: aciertos ?? null,
      total_rondas: totalRondas,
    });
  }

  getMejorMarca(userId: string, tipoJuego: string): Observable<number | null> {
    const ascendente = esMejorAscendente(tipoJuego);
    return from(
      supabase
        .from('juegos_scores')
        .select('valor')
        .eq('user_id', userId)
        .eq('tipo_juego', tipoJuego)
        .order('valor', { ascending: ascendente })
        .limit(1)
    ).pipe(
      map(({ data }) => {
        if (!data || data.length === 0) return null;
        return (data[0] as Record<string, unknown>)['valor'] as number;
      })
    );
  }

  getMisMejoresMarcas(userId: string): Observable<Map<string, number>> {
    return from(
      supabase
        .from('juegos_scores')
        .select('tipo_juego, valor')
        .eq('user_id', userId)
    ).pipe(
      map(({ data }) => {
        const mejores = new Map<string, number>();
        if (!data) return mejores;

        for (const row of data as Record<string, unknown>[]) {
          const tipo = row['tipo_juego'] as string;
          const valor = row['valor'] as number;
          const actual = mejores.get(tipo);

          if (actual === undefined) {
            mejores.set(tipo, valor);
          } else if (esMejorAscendente(tipo)) {
            if (valor < actual) mejores.set(tipo, valor);
          } else {
            if (valor > actual) mejores.set(tipo, valor);
          }
        }

        return mejores;
      })
    );
  }

  getRanking(tipoJuego: string, limit: number = 5): Observable<RankingJuego[]> {
    const ascendente = esMejorAscendente(tipoJuego);
    return from(
      supabase
        .from('juegos_scores')
        .select('user_id, valor, aciertos, profiles!inner(nombre, apellidos)')
        .eq('tipo_juego', tipoJuego)
        .order('valor', { ascending: ascendente })
        .limit(200)
    ).pipe(
      map(({ data }) => {
        if (!data) return [];

        const vistos = new Set<string>();
        const ranking: RankingJuego[] = [];

        for (const row of data as Record<string, unknown>[]) {
          const userId = row['user_id'] as string;
          if (vistos.has(userId)) continue;
          vistos.add(userId);

          const perfil = row['profiles'] as Record<string, unknown>;
          ranking.push({
            userId,
            nombre: perfil['nombre'] as string,
            apellidos: perfil['apellidos'] as string,
            valor: row['valor'] as number,
            aciertos: row['aciertos'] as number | null,
          });

          if (ranking.length >= limit) break;
        }

        return ranking;
      })
    );
  }
}
