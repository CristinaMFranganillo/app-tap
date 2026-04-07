import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Temporada, Cuota } from '../../../core/models/cuota.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toTemporada(row: Record<string, unknown>): Temporada {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    fechaInicio: new Date(row['fecha_inicio'] as string),
    activa: row['activa'] as boolean,
  };
}

function toCuota(row: Record<string, unknown>): Cuota {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    temporadaId: row['temporada_id'] as string,
    temporadaNombre: (row['temporadas'] as Record<string, unknown>)?.['nombre'] as string ?? '',
    pagada: row['pagada'] as boolean,
    fechaPago: row['fecha_pago'] ? new Date(row['fecha_pago'] as string) : undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class CuotaService {

  getTemporadaActiva(): Observable<Temporada | null> {
    return from(
      supabase.from('temporadas').select('*').eq('activa', true).maybeSingle()
    ).pipe(
      map(({ data }) => data ? toTemporada(data as Record<string, unknown>) : null)
    );
  }

  getTodasTemporadas(): Observable<Temporada[]> {
    return from(
      supabase.from('temporadas').select('*').order('fecha_inicio', { ascending: false })
    ).pipe(
      map(({ data }) => (data ?? []).map(r => toTemporada(r as Record<string, unknown>)))
    );
  }

  getCuotasSocio(userId: string): Observable<Cuota[]> {
    return from(
      supabase
        .from('cuotas')
        .select('*, temporadas(nombre)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data }) => (data ?? []).map(r => toCuota(r as Record<string, unknown>)))
    );
  }

  async crearTemporada(nombre: string, fechaInicio: Date): Promise<void> {
    // Desactivar temporada actual
    await supabase.from('temporadas').update({ activa: false }).eq('activa', true);

    // Crear nueva temporada activa
    const { data: nuevaTemporada, error: errT } = await supabase
      .from('temporadas')
      .insert({ nombre, fecha_inicio: fechaInicio.toISOString().split('T')[0], activa: true })
      .select()
      .single();
    if (errT) throw new Error(errT.message);

    // Obtener todos los socios activos
    const { data: socios, error: errS } = await supabase
      .from('profiles')
      .select('id')
      .eq('activo', true);
    if (errS) throw new Error(errS.message);

    // Insertar cuotas para cada socio
    if (socios && socios.length > 0) {
      const cuotas = socios.map((s: { id: string }) => ({
        user_id: s.id,
        temporada_id: (nuevaTemporada as { id: string }).id,
        pagada: false,
      }));
      const { error: errC } = await supabase.from('cuotas').insert(cuotas);
      if (errC) throw new Error(errC.message);
    }
  }

  async toggleCuota(cuotaId: string, pagada: boolean): Promise<void> {
    const payload: Record<string, unknown> = {
      pagada,
      fecha_pago: pagada ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('cuotas').update(payload).eq('id', cuotaId);
    if (error) throw new Error(error.message);
  }
}
