import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Escuadra, EscuadraTirador, Tarifa, MovimientoCaja } from '../../core/models/escuadra.model';
import { supabase } from '../../core/supabase/supabase.client';

function toEscuadra(row: Record<string, unknown>): Escuadra {
  return {
    id: row['id'] as string,
    competicionId: row['competicion_id'] as string | undefined,
    numero: row['numero'] as number,
  };
}

function toEscuadraTirador(row: Record<string, unknown>): EscuadraTirador {
  return {
    id: row['id'] as string,
    escuadraId: row['escuadra_id'] as string,
    userId: row['user_id'] as string | undefined,
    nombreExterno: row['nombre_externo'] as string | undefined,
    esNoSocio: (row['es_no_socio'] as boolean) ?? false,
    puesto: row['puesto'] as number,
  };
}

function toMovimiento(row: any): MovimientoCaja {
  return {
    id:              row['id'] as string,
    entrenamientoId: row['entrenamiento_id'] as string | undefined,
    escuadraId:      row['escuadra_id'] as string | undefined,
    torneoId:        row['torneo_id'] as string | undefined,
    userId:          row['user_id'] as string | undefined,
    nombreTirador:   row['nombre_tirador'] as string,
    esNoSocio:       row['es_no_socio'] as boolean,
    importe:         row['importe'] as number,
    fecha:           row['fecha'] as string,
    registradoPor:   row['registrado_por'] as string | undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class EscuadraService {

  // ── Escuadras ─────────────────────────────────────────────────────────────

  getByCompeticion(competicionId: string | null): Observable<Escuadra[]> {
    const query = competicionId === null
      ? supabase.from('escuadras').select('*').is('competicion_id', null).order('numero')
      : supabase.from('escuadras').select('*').eq('competicion_id', competicionId).order('numero');
    return from(query).pipe(map(({ data }) => (data ?? []).map(toEscuadra)));
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
          esquema: (row as any)['esquema'] as number | undefined,
          tiradores: ((row as any)['escuadra_tiradores'] ?? []).map(toEscuadraTirador),
        }))
      )
    );
  }

  getTiradoresByEscuadra(escuadraId: string): Observable<EscuadraTirador[]> {
    return from(
      supabase.from('escuadra_tiradores').select('*').eq('escuadra_id', escuadraId).order('puesto')
    ).pipe(map(({ data }) => (data ?? []).map(toEscuadraTirador)));
  }

  async createEscuadra(competicionId: string | null, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras').insert({ competicion_id: competicionId, numero }).select('id').single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }

  async createEscuadraEntrenamiento(entrenamientoId: string, numero: number, esquema?: number): Promise<string> {
    const payload: Record<string, unknown> = { entrenamiento_id: entrenamientoId, numero };
    if (esquema != null) payload['esquema'] = esquema;
    const { data, error } = await supabase
      .from('escuadras').insert(payload).select('id').single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }

  async createEscuadraTorneo(torneoId: string, numero: number): Promise<string> {
    const { data, error } = await supabase
      .from('escuadras').insert({ torneo_id: torneoId, numero }).select('id').single();
    if (error || !data) throw new Error('Error creando escuadra');
    return (data as Record<string, unknown>)['id'] as string;
  }

  getByTorneo(torneoId: string): Observable<Escuadra[]> {
    return from(
      supabase
        .from('escuadras')
        .select('*, escuadra_tiradores(*)')
        .eq('torneo_id', torneoId)
        .order('numero')
    ).pipe(
      map(({ data }) =>
        (data ?? []).map(row => ({
          id: (row as any)['id'] as string,
          torneoId: (row as any)['torneo_id'] as string,
          numero: (row as any)['numero'] as number,
          tiradores: ((row as any)['escuadra_tiradores'] ?? []).map(toEscuadraTirador),
        }))
      )
    );
  }

  async addTirador(escuadraId: string, userId: string, puesto: number): Promise<void> {
    const { error } = await supabase.from('escuadra_tiradores')
      .insert({ escuadra_id: escuadraId, user_id: userId, puesto, es_no_socio: false });
    if (error) throw new Error('Error añadiendo tirador: ' + error.message);
  }

  async addNoSocio(escuadraId: string, nombreExterno: string, puesto: number): Promise<void> {
    const { error } = await supabase.from('escuadra_tiradores')
      .insert({ escuadra_id: escuadraId, nombre_externo: nombreExterno, puesto, es_no_socio: true });
    if (error) throw new Error('Error añadiendo no socio: ' + error.message);
  }

  async removeTirador(id: string): Promise<void> {
    await supabase.from('escuadra_tiradores').delete().eq('id', id);
  }

  async deleteEscuadra(id: string): Promise<void> {
    await supabase.from('escuadras').delete().eq('id', id);
  }

  async deleteEscuadraEntrenamiento(id: string): Promise<void> {
    for (const tabla of ['entrenamiento_fallos', 'resultados_entrenamiento', 'movimientos_caja', 'escuadra_tiradores']) {
      const { error } = await supabase.from(tabla).delete().eq('escuadra_id', id);
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase.from('escuadras').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Tarifas ───────────────────────────────────────────────────────────────

  getTarifas(): Observable<Tarifa[]> {
    return from(supabase.from('tarifas').select('*')).pipe(
      map(({ data }) => (data ?? []).map(row => ({
        id:      row['id'] as string,
        tipo:    row['tipo'] as 'socio' | 'no_socio',
        importe: row['importe'] as number,
      })))
    );
  }

  async updateTarifa(id: string, importe: number): Promise<void> {
    const { error } = await supabase.from('tarifas')
      .update({ importe, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error('Error actualizando tarifa: ' + error.message);
  }

  // ── Caja — escritura ──────────────────────────────────────────────────────

  async registrarCajaEscuadra(
    escuadraId: string,
    entrenamientoId: string | null,
    fecha: string,
    registradoPor: string,
    tiradores: { userId?: string; nombreTirador: string; esNoSocio: boolean; importe: number }[],
    torneoId: string | null = null
  ): Promise<void> {
    if (tiradores.length === 0) return;
    const rows = tiradores.map(t => ({
      escuadra_id:      escuadraId,
      entrenamiento_id: entrenamientoId,
      torneo_id:        torneoId,
      user_id:          t.userId ?? null,
      nombre_tirador:   t.nombreTirador,
      es_no_socio:      t.esNoSocio,
      importe:          t.importe,
      fecha,
      registrado_por:   registradoPor,
    }));
    const { error } = await supabase.from('movimientos_caja').insert(rows);
    if (error) throw new Error('Error registrando caja: ' + error.message);
  }

  // ── Caja — lectura ────────────────────────────────────────────────────────

  getMovimientosCajaByEntrenamiento(entrenamientoId: string): Observable<MovimientoCaja[]> {
    return from(
      supabase.from('movimientos_caja').select('*')
        .eq('entrenamiento_id', entrenamientoId).order('created_at')
    ).pipe(map(({ data }) => (data ?? []).map(toMovimiento)));
  }

  getMovimientosCajaByFecha(fecha: string): Observable<MovimientoCaja[]> {
    return from(
      supabase.from('movimientos_caja').select('*')
        .eq('fecha', fecha).order('created_at')
    ).pipe(map(({ data }) => (data ?? []).map(toMovimiento)));
  }

  getMovimientosCajaByMes(mes: string): Observable<MovimientoCaja[]> {
    const [y, m] = mes.split('-');
    const desde  = `${y}-${m}-01`;
    const hasta  = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
    return from(
      supabase.from('movimientos_caja').select('*')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha').order('created_at')
    ).pipe(map(({ data }) => (data ?? []).map(toMovimiento)));
  }

  getMovimientosCajaByAno(anio: number): Observable<MovimientoCaja[]> {
    return from(
      supabase.from('movimientos_caja').select('*')
        .gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
        .order('fecha').order('created_at')
    ).pipe(map(({ data }) => (data ?? []).map(toMovimiento)));
  }
}
