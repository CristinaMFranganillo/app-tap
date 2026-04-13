import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { Torneo, ResultadoTorneo, FalloTorneo, RankingTorneo } from '../../../core/models/torneo.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toTorneo(row: Record<string, unknown>): Torneo {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    fecha: row['fecha'] as string,
    creadoPor: row['creado_por'] as string,
    createdAt: row['created_at'] as string,
    precioInscripcionSocio: Number(row['precio_inscripcion_socio'] ?? 0),
    precioInscripcionNoSocio: Number(row['precio_inscripcion_no_socio'] ?? 0),
  };
}

function toResultado(row: Record<string, unknown>): ResultadoTorneo {
  return {
    id: row['id'] as string,
    escuadraId: row['escuadra_id'] as string,
    userId: row['user_id'] as string | undefined,
    nombreExterno: row['nombre_externo'] as string | undefined,
    esNoSocio: (row['es_no_socio'] as boolean) ?? false,
    puesto: row['puesto'] as number,
    platosRotos: row['platos_rotos'] as number,
  };
}

@Injectable({ providedIn: 'root' })
export class TorneoService {

  getAll(): Observable<Torneo[]> {
    return from(
      supabase
        .from('torneos')
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
            ...toTorneo(row as Record<string, unknown>),
            numEscuadras: escuadras.length,
            numTiradores,
          };
        })
      )
    );
  }

  getById(id: string): Observable<Torneo> {
    return from(
      supabase.from('torneos').select('*').eq('id', id).single()
    ).pipe(map(({ data }) => toTorneo(data as Record<string, unknown>)));
  }

  async create(
    nombre: string,
    fecha: string,
    creadoPor: string,
    precioInscripcionSocio: number,
    precioInscripcionNoSocio: number
  ): Promise<string> {
    const { data, error } = await supabase
      .from('torneos')
      .insert({
        nombre,
        fecha,
        creado_por: creadoPor,
        precio_inscripcion_socio: precioInscripcionSocio,
        precio_inscripcion_no_socio: precioInscripcionNoSocio,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Error creando torneo');
    return (data as Record<string, unknown>)['id'] as string;
  }

  async update(
    id: string,
    nombre: string,
    fecha: string,
    precioInscripcionSocio?: number,
    precioInscripcionNoSocio?: number
  ): Promise<void> {
    const payload: Record<string, unknown> = { nombre, fecha };
    if (precioInscripcionSocio != null) payload['precio_inscripcion_socio'] = precioInscripcionSocio;
    if (precioInscripcionNoSocio != null) payload['precio_inscripcion_no_socio'] = precioInscripcionNoSocio;
    const { error } = await supabase
      .from('torneos')
      .update(payload)
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  // Devuelve los user_id de socios que ya tienen inscripción registrada en el torneo
  async getSociosInscritos(torneoId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('movimientos_caja')
      .select('user_id')
      .eq('torneo_id', torneoId)
      .eq('es_no_socio', false)
      .not('user_id', 'is', null);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
  }

  async deleteTorneo(id: string): Promise<void> {
    const { data: escuadras, error: escErr } = await supabase
      .from('escuadras').select('id').eq('torneo_id', id);
    if (escErr) throw new Error(escErr.message);

    const ids = (escuadras ?? []).map((e: Record<string, unknown>) => e['id'] as string);

    if (ids.length > 0) {
      for (const tabla of ['torneo_fallos', 'resultados_torneo', 'movimientos_caja', 'escuadra_tiradores']) {
        const { error } = await supabase.from(tabla).delete().in('escuadra_id', ids);
        if (error) throw new Error(error.message);
      }
      const { error } = await supabase.from('escuadras').delete().eq('torneo_id', id);
      if (error) throw new Error(error.message);
    }

    const { error } = await supabase.from('torneos').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Resultados ──────────────────────────────────────────────────────

  getResultadosByEscuadra(escuadraId: string): Observable<ResultadoTorneo[]> {
    return from(
      supabase
        .from('resultados_torneo')
        .select('*')
        .eq('escuadra_id', escuadraId)
        .order('puesto')
    ).pipe(map(({ data }) => (data ?? []).map(r => toResultado(r as Record<string, unknown>))));
  }

  async upsertResultados(
    resultados: {
      escuadraId: string;
      userId?: string;
      nombreExterno?: string;
      esNoSocio: boolean;
      puesto: number;
      platosRotos: number;
    }[],
    registradoPor: string
  ): Promise<void> {
    const socios = resultados.filter(r => !r.esNoSocio);
    const noSocios = resultados.filter(r => r.esNoSocio);

    if (socios.length > 0) {
      const rows = socios.map(r => ({
        escuadra_id: r.escuadraId,
        user_id: r.userId,
        es_no_socio: false,
        puesto: r.puesto,
        platos_rotos: r.platosRotos,
        registrado_por: registradoPor,
      }));
      const { error } = await supabase
        .from('resultados_torneo')
        .upsert(rows, { onConflict: 'escuadra_id,user_id' });
      if (error) throw new Error(error.message);
    }

    if (noSocios.length > 0) {
      const rows = noSocios.map(r => ({
        escuadra_id: r.escuadraId,
        nombre_externo: r.nombreExterno,
        es_no_socio: true,
        puesto: r.puesto,
        platos_rotos: r.platosRotos,
        registrado_por: registradoPor,
      }));
      const { error } = await supabase
        .from('resultados_torneo')
        .upsert(rows, { onConflict: 'escuadra_id,nombre_externo' });
      if (error) throw new Error(error.message);
    }
  }

  getRanking(torneoId: string): Observable<RankingTorneo[]> {
    return from(
      supabase
        .from('resultados_torneo')
        .select('user_id, platos_rotos, escuadras!inner(torneo_id), profiles:user_id(nombre, apellidos)')
        .eq('escuadras.torneo_id', torneoId)
        .eq('es_no_socio', false)
    ).pipe(
      map(({ data }) => {
        const agg = new Map<string, { nombre: string; apellidos: string; platos: number }>();
        for (const row of (data ?? []) as any[]) {
          const uid = row['user_id'] as string;
          const platos = row['platos_rotos'] as number;
          const profile = row['profiles'] as any;
          if (!agg.has(uid)) {
            agg.set(uid, {
              nombre: profile?.nombre ?? '',
              apellidos: profile?.apellidos ?? '',
              platos: 0,
            });
          }
          agg.get(uid)!.platos += platos;
        }
        return Array.from(agg.entries())
          .map(([userId, v]) => ({
            userId,
            nombre: v.nombre,
            apellidos: v.apellidos,
            platosRotos: v.platos,
            posicion: 0,
          }))
          .sort((a, b) => b.platosRotos - a.platosRotos)
          .map((entry, i) => ({ ...entry, posicion: i + 1 }));
      })
    );
  }

  // ── Fallos ──────────────────────────────────────────────────────────

  async upsertFallos(
    fallos: FalloTorneo[],
    escuadraId: string,
    userIds: string[]
  ): Promise<void> {
    if (userIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('torneo_fallos')
        .delete()
        .eq('escuadra_id', escuadraId)
        .in('user_id', userIds);
      if (deleteError) throw new Error(deleteError.message);
    }
    if (fallos.length > 0) {
      const rows = fallos.map(f => ({
        escuadra_id: f.escuadraId,
        user_id: f.userId,
        numero_plato: f.numeroPlato,
      }));
      const { error } = await supabase.from('torneo_fallos').insert(rows);
      if (error) throw new Error(error.message);
    }
  }

  getFallosByEscuadra(escuadraId: string): Observable<FalloTorneo[]> {
    return from(
      supabase
        .from('torneo_fallos')
        .select('*')
        .eq('escuadra_id', escuadraId)
        .order('user_id')
        .order('numero_plato')
    ).pipe(
      map(({ data }) =>
        (data ?? []).map((row: Record<string, unknown>) => ({
          escuadraId: row['escuadra_id'] as string,
          userId: row['user_id'] as string,
          numeroPlato: row['numero_plato'] as number,
        }))
      )
    );
  }

  // ── Escuadras ───────────────────────────────────────────────────────

  async deleteEscuadraTorneo(id: string): Promise<void> {
    for (const tabla of ['torneo_fallos', 'resultados_torneo', 'movimientos_caja', 'escuadra_tiradores']) {
      const { error } = await supabase.from(tabla).delete().eq('escuadra_id', id);
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase.from('escuadras').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
