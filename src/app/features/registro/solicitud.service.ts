import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { SolicitudRegistro, EstadoSolicitud } from '../../core/models/solicitud.model';
import { supabase } from '../../core/supabase/supabase.client';

function toSolicitud(row: Record<string, unknown>): SolicitudRegistro {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    apellidos: row['apellidos'] as string,
    email: row['email'] as string,
    mensaje: (row['mensaje'] as string) ?? undefined,
    estado: row['estado'] as EstadoSolicitud,
    fecha: new Date(row['fecha'] as string),
    revisadaPor: (row['revisada_por'] as string) ?? undefined,
    fechaRevision: row['fecha_revision'] ? new Date(row['fecha_revision'] as string) : undefined,
    motivoRechazo: (row['motivo_rechazo'] as string) ?? undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class SolicitudService {
  /** Admin: obtiene todas las solicitudes */
  getAll(): Observable<SolicitudRegistro[]> {
    return from(
      supabase.from('solicitudes_registro').select('*').order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toSolicitud)));
  }

  /** Público: envía una nueva solicitud de registro */
  async create(data: { nombre: string; apellidos: string; email: string; mensaje?: string }): Promise<void> {
    const { error } = await supabase.from('solicitudes_registro').insert({
      nombre: data.nombre,
      apellidos: data.apellidos,
      email: data.email,
      mensaje: data.mensaje ?? null,
    });
    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya existe una solicitud con este email.');
      }
      throw new Error('Error al enviar la solicitud. Inténtalo de nuevo.');
    }
  }

  /** Admin: acepta una solicitud llamando a la Edge Function */
  async aceptar(solicitudId: string, numeroSocio: string, rol: string): Promise<void> {
    const { error } = await supabase.functions.invoke('aceptar-solicitud', {
      body: { solicitudId, numeroSocio, rol },
    });
    if (error) throw new Error('Error al aceptar la solicitud.');
  }

  /** Admin: rechaza una solicitud llamando a la Edge Function */
  async rechazar(solicitudId: string, motivo?: string): Promise<void> {
    const { error } = await supabase.functions.invoke('rechazar-solicitud', {
      body: { solicitudId, motivo: motivo ?? null },
    });
    if (error) throw new Error('Error al rechazar la solicitud.');
  }
}
