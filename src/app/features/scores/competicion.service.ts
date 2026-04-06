import { Injectable } from '@angular/core';
import { from, Observable, map, tap, BehaviorSubject } from 'rxjs';
import { Competicion } from '../../core/models/competicion.model';
import { supabase } from '../../core/supabase/supabase.client';

function toCompeticion(row: Record<string, unknown>): Competicion {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    modalidad: row['modalidad'] as string,
    totalPlatos: row['total_platos'] as number,
    fecha: new Date(row['fecha'] as string),
    activa: row['activa'] as boolean,
    creadaPor: row['creada_por'] as string,
  };
}

@Injectable({ providedIn: 'root' })
export class CompeticionService {
  private cache = new BehaviorSubject<Competicion[]>([]);

  getAll(): Observable<Competicion[]> {
    return from(
      supabase.from('competiciones').select('*').order('fecha', { ascending: false })
    ).pipe(
      map(({ data }) => (data ?? []).map(toCompeticion)),
      tap(items => this.cache.next(items))
    );
  }

  getActiva(): Observable<Competicion | undefined> {
    return from(
      supabase.from('competiciones').select('*').eq('activa', true).limit(1)
    ).pipe(map(({ data }) => data && data.length > 0 ? toCompeticion(data[0] as Record<string, unknown>) : undefined));
  }

  getById(id: string): Competicion | undefined {
    return this.cache.getValue().find(c => c.id === id);
  }

  async create(data: Omit<Competicion, 'id'>): Promise<void> {
    await supabase.from('competiciones').insert({
      nombre: data.nombre,
      modalidad: data.modalidad,
      total_platos: data.totalPlatos,
      fecha: data.fecha.toISOString(),
      activa: data.activa,
      creada_por: data.creadaPor,
    });
  }

  async update(id: string, data: Partial<Competicion>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.nombre !== undefined) payload['nombre'] = data.nombre;
    if (data.modalidad !== undefined) payload['modalidad'] = data.modalidad;
    if (data.totalPlatos !== undefined) payload['total_platos'] = data.totalPlatos;
    if (data.fecha !== undefined) payload['fecha'] = data.fecha.toISOString();
    if (data.activa !== undefined) payload['activa'] = data.activa;
    await supabase.from('competiciones').update(payload).eq('id', id);
  }
}
