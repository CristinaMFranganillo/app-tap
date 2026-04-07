import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Entrenamiento, EntrenamientoDia, ResultadoEntrenamiento, ResultadoEntrenamientoConFecha, RankingEntrenamientoAnual } from '../../../core/models/entrenamiento.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toEntrenamiento(row: Record<string, unknown>): Entrenamiento {
  return {
    id: row['id'] as string,
    fecha: row['fecha'] as string,
    creadoPor: row['creado_por'] as string,
    createdAt: row['created_at'] as string,
    numEscuadras: (row['num_escuadras'] as number) ?? 0,
  };
}

function toResultado(row: Record<string, unknown>): ResultadoEntrenamiento {
  return {
    id: row['id'] as string,
    escuadraId: row['escuadra_id'] as string,
    userId: row['user_id'] as string,
    puesto: row['puesto'] as number,
    platosRotos: row['platos_rotos'] as number,
  };
}

@Injectable({ providedIn: 'root' })
export class EntrenamientoService {

  getAll(): Observable<Entrenamiento[]> {
    return from(
      supabase
        .from('entrenamientos')
        .select('*, escuadras(id, escuadra_tiradores(count))')
        .order('fecha', { ascending: false })
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => {
          const escuadras = (row as any).escuadras ?? [];
          const numTiradores = escuadras.reduce(
            (sum: number, e: any) => sum + (e.escuadra_tiradores?.[0]?.count ?? 0),
            0
          );
          return {
            ...toEntrenamiento(row as Record<string, unknown>),
            numEscuadras: escuadras.length,
            numTiradores,
          };
        })
      )
    );
  }

  getAllAgrupado(): Observable<EntrenamientoDia[]> {
    return this.getAll().pipe(
      map(lista => {
        const mapaFecha = new Map<string, EntrenamientoDia>();
        for (const e of lista) {
          if (!mapaFecha.has(e.fecha)) {
            mapaFecha.set(e.fecha, { fecha: e.fecha, ids: [], numEscuadras: 0, numTiradores: 0 });
          }
          const dia = mapaFecha.get(e.fecha)!;
          dia.ids.push(e.id);
          dia.numEscuadras += e.numEscuadras ?? 0;
          dia.numTiradores += e.numTiradores ?? 0;
        }
        return Array.from(mapaFecha.values())
          .sort((a, b) => b.fecha.localeCompare(a.fecha));
      })
    );
  }

  getByFecha(fecha: string): Observable<Entrenamiento[]> {
    return from(
      supabase
        .from('entrenamientos')
        .select('*, escuadras(id, escuadra_tiradores(count))')
        .eq('fecha', fecha)
        .order('created_at')
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => {
          const escuadras = (row as any).escuadras ?? [];
          const numTiradores = escuadras.reduce(
            (sum: number, e: any) => sum + (e.escuadra_tiradores?.[0]?.count ?? 0),
            0
          );
          return {
            ...toEntrenamiento(row as Record<string, unknown>),
            numEscuadras: escuadras.length,
            numTiradores,
          };
        })
      )
    );
  }

  getById(id: string): Observable<Entrenamiento> {
    return from(
      supabase.from('entrenamientos').select('*').eq('id', id).single()
    ).pipe(map(({ data }) => toEntrenamiento(data as Record<string, unknown>)));
  }

  async create(fecha: string, creadoPor: string): Promise<string> {
    const { data, error } = await supabase
      .from('entrenamientos')
      .insert({ fecha, creado_por: creadoPor })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Error creando entrenamiento');
    return (data as Record<string, unknown>)['id'] as string;
  }

  getResultadosByEscuadra(escuadraId: string): Observable<ResultadoEntrenamiento[]> {
    return from(
      supabase
        .from('resultados_entrenamiento')
        .select('*')
        .eq('escuadra_id', escuadraId)
        .order('puesto')
    ).pipe(map(({ data }) => (data ?? []).map(toResultado)));
  }

  async upsertResultados(
    resultados: { escuadraId: string; userId: string; puesto: number; platosRotos: number }[],
    registradoPor: string
  ): Promise<void> {
    const rows = resultados.map(r => ({
      escuadra_id: r.escuadraId,
      user_id: r.userId,
      puesto: r.puesto,
      platos_rotos: r.platosRotos,
      registrado_por: registradoPor,
    }));
    const { error } = await supabase
      .from('resultados_entrenamiento')
      .upsert(rows, { onConflict: 'escuadra_id,user_id' });
    if (error) throw new Error(error?.message ?? 'Error guardando resultados');
  }

  getByUser(userId: string, year: number): Observable<ResultadoEntrenamientoConFecha[]> {
    const fromDate = `${year}-01-01`;
    const toDate = `${year}-12-31`;
    return from(
      supabase
        .from('resultados_entrenamiento')
        .select('*, escuadras!inner(entrenamiento_id, entrenamientos!inner(fecha))')
        .eq('user_id', userId)
        .gte('escuadras.entrenamientos.fecha', fromDate)
        .lte('escuadras.entrenamientos.fecha', toDate)
    ).pipe(
      map(({ data }) =>
        (data ?? []).map((row: any) => ({
          id: row['id'] as string,
          escuadraId: row['escuadra_id'] as string,
          entrenamientoId: row['escuadras']['entrenamiento_id'] as string,
          userId: row['user_id'] as string,
          puesto: row['puesto'] as number,
          platosRotos: row['platos_rotos'] as number,
          fecha: row['escuadras']['entrenamientos']['fecha'] as string,
        })).sort((a: ResultadoEntrenamientoConFecha, b: ResultadoEntrenamientoConFecha) =>
          b.fecha.localeCompare(a.fecha)
        )
      )
    );
  }

  getRankingAnual(year: number): Observable<RankingEntrenamientoAnual[]> {
    const fromDate = `${year}-01-01`;
    const toDate = `${year}-12-31`;
    return from(
      supabase
        .from('resultados_entrenamiento')
        .select('user_id, platos_rotos, escuadras!inner(entrenamientos!inner(fecha))')
        .gte('escuadras.entrenamientos.fecha', fromDate)
        .lte('escuadras.entrenamientos.fecha', toDate)
    ).pipe(
      map(({ data }) => {
        const map = new Map<string, { suma: number; count: number; mejor: number }>();
        for (const row of (data ?? []) as any[]) {
          const uid = row['user_id'] as string;
          const platos = row['platos_rotos'] as number;
          if (!map.has(uid)) map.set(uid, { suma: 0, count: 0, mejor: 0 });
          const entry = map.get(uid)!;
          entry.suma += platos;
          entry.count += 1;
          if (platos > entry.mejor) entry.mejor = platos;
        }
        return Array.from(map.entries()).map(([userId, v]) => ({
          userId,
          mediaPlatos: Math.round((v.suma / v.count) * 10) / 10,
          totalEntrenamientos: v.count,
          mejorResultado: v.mejor,
        })).sort((a, b) => b.mediaPlatos - a.mediaPlatos);
      })
    );
  }
}
