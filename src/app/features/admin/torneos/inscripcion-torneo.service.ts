import { Injectable } from '@angular/core';
import { supabase } from '../../../core/supabase/supabase.client';
import { InscritoVista } from '../../../core/models/inscripcion-torneo.model';

@Injectable({ providedIn: 'root' })
export class InscripcionTorneoService {

  async listarInscritos(torneoId: string): Promise<InscritoVista[]> {
    const { data: inscripciones, error: insErr } = await supabase
      .from('inscripciones_torneo')
      .select('id, user_id, nombre, apellidos, es_no_socio, precio_pagado, profiles:user_id(nombre, apellidos)')
      .eq('torneo_id', torneoId);
    if (insErr) throw new Error(insErr.message);

    const { data: escuadras, error: escErr } = await supabase
      .from('escuadras')
      .select('id, escuadra_tiradores(user_id, nombre_externo, es_no_socio)')
      .eq('torneo_id', torneoId);
    if (escErr) throw new Error(escErr.message);

    const sociosEnEscuadra = new Set<string>();
    const invitadosEnEscuadra = new Set<string>();
    for (const e of (escuadras ?? []) as any[]) {
      for (const t of e.escuadra_tiradores ?? []) {
        if (t.es_no_socio && t.nombre_externo) {
          invitadosEnEscuadra.add(this.normaliza(t.nombre_externo));
        } else if (t.user_id) {
          sociosEnEscuadra.add(t.user_id);
        }
      }
    }

    const vista: InscritoVista[] = ((inscripciones ?? []) as any[]).map(row => {
      if (row.es_no_socio) {
        const nombre = row.nombre as string;
        const apellidos = row.apellidos as string;
        return {
          id: row.id,
          esNoSocio: true,
          nombre,
          apellidos,
          precioPagado: Number(row.precio_pagado ?? 0),
          enEscuadra: invitadosEnEscuadra.has(this.normaliza(`${nombre} ${apellidos}`)),
        };
      }
      const profile = row.profiles as { nombre?: string; apellidos?: string } | null;
      return {
        id: row.id,
        esNoSocio: false,
        userId: row.user_id,
        nombre: profile?.nombre ?? '',
        apellidos: profile?.apellidos ?? '',
        precioPagado: Number(row.precio_pagado ?? 0),
        enEscuadra: sociosEnEscuadra.has(row.user_id),
      };
    });

    return vista.sort((a, b) =>
      `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es')
    );
  }

  async inscribirSocio(torneoId: string, userId: string, creadoPor: string): Promise<string> {
    const { data: torneo, error: tErr } = await supabase
      .from('torneos')
      .select('precio_inscripcion_socio')
      .eq('id', torneoId)
      .single();
    if (tErr || !torneo) throw new Error(tErr?.message ?? 'Torneo no encontrado');

    const precio = Number((torneo as any).precio_inscripcion_socio ?? 0);

    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre, apellidos')
      .eq('id', userId)
      .single();
    const nombreTirador = profile
      ? `${(profile as any).apellidos}, ${(profile as any).nombre}`
      : '';

    const { data, error } = await supabase
      .from('inscripciones_torneo')
      .insert({
        torneo_id: torneoId,
        user_id: userId,
        nombre: null,
        apellidos: null,
        es_no_socio: false,
        precio_pagado: precio,
        creado_por: creadoPor,
      })
      .select('id')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        throw new Error('Este socio ya está inscrito en el torneo');
      }
      throw new Error(error.message);
    }

    await this.registrarMovimientoCaja({
      torneoId,
      userId,
      nombreTirador,
      esNoSocio: false,
      importe: precio,
      registradoPor: creadoPor,
    });

    return (data as any).id as string;
  }

  async inscribirInvitado(
    torneoId: string,
    nombre: string,
    apellidos: string,
    creadoPor: string
  ): Promise<string> {
    const n = nombre.trim();
    const a = apellidos.trim();
    if (!n || !a) throw new Error('Nombre y apellidos son obligatorios');

    const { data: torneo, error: tErr } = await supabase
      .from('torneos')
      .select('precio_inscripcion_no_socio')
      .eq('id', torneoId)
      .single();
    if (tErr || !torneo) throw new Error(tErr?.message ?? 'Torneo no encontrado');

    const precio = Number((torneo as any).precio_inscripcion_no_socio ?? 0);

    const { data, error } = await supabase
      .from('inscripciones_torneo')
      .insert({
        torneo_id: torneoId,
        user_id: null,
        nombre: n,
        apellidos: a,
        es_no_socio: true,
        precio_pagado: precio,
        creado_por: creadoPor,
      })
      .select('id')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        throw new Error('Este invitado ya está inscrito en el torneo');
      }
      throw new Error(error.message);
    }

    await this.registrarMovimientoCaja({
      torneoId,
      userId: undefined,
      nombreTirador: `${a}, ${n}`,
      esNoSocio: true,
      importe: precio,
      registradoPor: creadoPor,
    });

    return (data as any).id as string;
  }

  async eliminarInscripcion(inscrito: InscritoVista, torneoId: string): Promise<void> {
    if (inscrito.enEscuadra) {
      throw new Error('No se puede eliminar: el inscrito ya está asignado a una escuadra');
    }

    let delMov = supabase
      .from('movimientos_caja')
      .delete()
      .eq('torneo_id', torneoId)
      .is('escuadra_id', null);
    delMov = inscrito.esNoSocio
      ? delMov.is('user_id', null).eq('nombre_tirador', `${inscrito.apellidos}, ${inscrito.nombre}`)
      : delMov.eq('user_id', inscrito.userId!);
    const { error: mErr } = await delMov;
    if (mErr) throw new Error(mErr.message);

    const { error } = await supabase
      .from('inscripciones_torneo')
      .delete()
      .eq('id', inscrito.id);
    if (error) throw new Error(error.message);
  }

  private async registrarMovimientoCaja(m: {
    torneoId: string;
    userId?: string;
    nombreTirador: string;
    esNoSocio: boolean;
    importe: number;
    registradoPor: string;
  }): Promise<void> {
    const fecha = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('movimientos_caja').insert({
      escuadra_id:      null,
      entrenamiento_id: null,
      torneo_id:        m.torneoId,
      user_id:          m.userId ?? null,
      nombre_tirador:   m.nombreTirador,
      es_no_socio:      m.esNoSocio,
      importe:          m.importe,
      fecha,
      registrado_por:   m.registradoPor,
    });
    if (error) throw new Error('Error registrando caja: ' + error.message);
  }

  private normaliza(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
