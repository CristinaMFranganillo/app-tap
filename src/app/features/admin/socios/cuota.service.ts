import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Temporada, Cuota } from '../../../core/models/cuota.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toTemporada(row: Record<string, unknown>): Temporada {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    fechaInicio: new Date(row['fecha_inicio'] as string),
    fechaFin: row['fecha_fin'] ? new Date(row['fecha_fin'] as string) : undefined,
    activa: row['activa'] as boolean,
    importeSocio: Number(row['importe_socio'] ?? 25),
    importeDirectivo: Number(row['importe_directivo'] ?? 25),
    importeHonor: Number(row['importe_honor'] ?? 0),
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

  async crearTemporada(
    nombre: string,
    fechaInicio: Date,
    fechaFin?: Date,
    importeSocio = 25,
    importeDirectivo = 25,
    importeHonor = 0
  ): Promise<void> {
    // Desactivar temporada actual
    await supabase.from('temporadas').update({ activa: false }).eq('activa', true);

    // Crear nueva temporada activa
    const insertPayload: Record<string, unknown> = {
      nombre,
      fecha_inicio: fechaInicio.toISOString().split('T')[0],
      activa: true,
      importe_socio: importeSocio,
      importe_directivo: importeDirectivo,
      importe_honor: importeHonor,
    };
    if (fechaFin) {
      insertPayload['fecha_fin'] = fechaFin.toISOString().split('T')[0];
    }
    const { data: nuevaTemporada, error: errT } = await supabase
      .from('temporadas')
      .insert(insertPayload)
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

  async editarTemporada(
    id: string,
    nombre: string,
    fechaInicio: Date,
    fechaFin?: Date,
    importeSocio?: number,
    importeDirectivo?: number,
    importeHonor?: number
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      nombre,
      fecha_inicio: fechaInicio.toISOString().split('T')[0],
      fecha_fin: fechaFin ? fechaFin.toISOString().split('T')[0] : null,
    };
    if (importeSocio != null) payload['importe_socio'] = importeSocio;
    if (importeDirectivo != null) payload['importe_directivo'] = importeDirectivo;
    if (importeHonor != null) payload['importe_honor'] = importeHonor;
    const { error } = await supabase
      .from('temporadas')
      .update(payload)
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async eliminarTemporada(id: string): Promise<void> {
    const { error } = await supabase
      .from('temporadas')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  getResumenCuotasTemporada(temporadaId: string): Observable<{
    socio: { total: number; pagadas: number };
    directivo: { total: number; pagadas: number };
    honor: { total: number; pagadas: number };
  }> {
    return from(
      supabase
        .from('cuotas')
        .select('pagada, profiles!inner(tipo_cuota)')
        .eq('temporada_id', temporadaId)
    ).pipe(
      map(({ data }) => {
        const acc = {
          socio: { total: 0, pagadas: 0 },
          directivo: { total: 0, pagadas: 0 },
          honor: { total: 0, pagadas: 0 },
        };
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          const pagada = row['pagada'] as boolean;
          const profile = row['profiles'] as Record<string, unknown>;
          const tipo = (profile?.['tipo_cuota'] as 'socio' | 'directivo' | 'honor') ?? 'socio';
          acc[tipo].total++;
          if (pagada) acc[tipo].pagadas++;
        }
        return acc;
      })
    );
  }

  getSociosPendientesByTemporada(temporadaId: string): Observable<{ id: string; nombre: string; apellidos: string }[]> {
    return from(
      supabase
        .from('cuotas')
        .select('user_id, pagada, profiles!inner(id, nombre, apellidos)')
        .eq('temporada_id', temporadaId)
        .eq('pagada', false)
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => {
          const p = (row as Record<string, unknown>)['profiles'] as Record<string, unknown>;
          return {
            id: p['id'] as string,
            nombre: p['nombre'] as string,
            apellidos: p['apellidos'] as string,
          };
        })
      )
    );
  }
}
