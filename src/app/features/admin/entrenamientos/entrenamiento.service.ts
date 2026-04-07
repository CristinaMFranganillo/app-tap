import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Entrenamiento, ResultadoEntrenamiento } from '../../../core/models/entrenamiento.model';
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
        .select('*, escuadras(count)')
        .order('fecha', { ascending: false })
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => ({
          ...toEntrenamiento(row as Record<string, unknown>),
          numEscuadras: (row as any).escuadras?.[0]?.count ?? 0,
        }))
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
    if (error) throw new Error('Error guardando resultados');
  }
}
