import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Escuadra, EscuadraTirador } from '../../core/models/escuadra.model';
import { supabase } from '../../core/supabase/supabase.client';

function toEscuadra(row: Record<string, unknown>): Escuadra {
  return {
    id: row['id'] as string,
    competicionId: row['competicion_id'] as string,
    numero: row['numero'] as number,
  };
}

function toEscuadraTirador(row: Record<string, unknown>): EscuadraTirador {
  return {
    id: row['id'] as string,
    escuadraId: row['escuadra_id'] as string,
    userId: row['user_id'] as string,
    puesto: row['puesto'] as number,
  };
}

@Injectable({ providedIn: 'root' })
export class EscuadraService {
  getByCompeticion(competicionId: string | null): Observable<Escuadra[]> {
    const query = competicionId === null
      ? supabase.from('escuadras').select('*').is('competicion_id', null).order('numero')
      : supabase.from('escuadras').select('*').eq('competicion_id', competicionId).order('numero');
    return from(query).pipe(map(({ data }) => (data ?? []).map(toEscuadra)));
  }

  getTiradoresByEscuadra(escuadraId: string): Observable<EscuadraTirador[]> {
    return from(
      supabase.from('escuadra_tiradores').select('*').eq('escuadra_id', escuadraId).order('puesto')
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadraTirador)));
  }

  async createEscuadra(competicionId: string | null, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras')
      .insert({ competicion_id: competicionId, numero })
      .select('id')
      .single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }

  async addTirador(escuadraId: string, userId: string, puesto: number): Promise<void> {
    const { error } = await supabase
      .from('escuadra_tiradores')
      .insert({ escuadra_id: escuadraId, user_id: userId, puesto });
    if (error) throw new Error('Error añadiendo tirador');
  }

  async removeTirador(id: string): Promise<void> {
    await supabase.from('escuadra_tiradores').delete().eq('id', id);
  }

  async deleteEscuadra(id: string): Promise<void> {
    await supabase.from('escuadras').delete().eq('id', id);
  }

  getByEntrenamiento(entrenamientoId: string): Observable<Escuadra[]> {
    return from(
      supabase
        .from('escuadras')
        .select('*, escuadra_tiradores(*)')
        .eq('entrenamiento_id', entrenamientoId)
        .order('numero')
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => ({
          id: (row as any)['id'] as string,
          entrenamientoId: (row as any)['entrenamiento_id'] as string,
          numero: (row as any)['numero'] as number,
          tiradores: ((row as any)['escuadra_tiradores'] ?? []).map((t: Record<string, unknown>) => ({
            id: t['id'] as string,
            escuadraId: t['escuadra_id'] as string,
            userId: t['user_id'] as string,
            puesto: t['puesto'] as number,
          })),
        }))
      )
    );
  }

  async createEscuadraEntrenamiento(entrenamientoId: string, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras')
      .insert({ entrenamiento_id: entrenamientoId, numero })
      .select('id')
      .single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }
}
