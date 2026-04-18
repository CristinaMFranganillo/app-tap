import { Injectable, inject } from '@angular/core';
import { supabase } from '../../../core/supabase/supabase.client';
import { AuthService } from '../../../core/auth/auth.service';
import { Notificacion, NotificacionForm } from '../../../core/models/notificacion.model';

@Injectable({ providedIn: 'root' })
export class NotificacionesAdminService {
  private auth = inject(AuthService);

  async getAll(): Promise<Notificacion[]> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, titulo, cuerpo, tipo, destinatarios, fecha_expiracion, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return (data as Record<string, unknown>[]).map(row => ({
      id:              row['id'] as string,
      titulo:          row['titulo'] as string,
      cuerpo:          row['cuerpo'] as string,
      tipo:            row['tipo'] as Notificacion['tipo'],
      destinatarios:   (row['destinatarios'] as string[] | null) ?? null,
      fechaExpiracion: (row['fecha_expiracion'] as string | null) ?? null,
      createdAt:       row['created_at'] as string,
      leida:           false,
    }));
  }

  async getById(id: string): Promise<Notificacion | null> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, titulo, cuerpo, tipo, destinatarios, fecha_expiracion, created_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    return {
      id:              row['id'] as string,
      titulo:          row['titulo'] as string,
      cuerpo:          row['cuerpo'] as string,
      tipo:            row['tipo'] as Notificacion['tipo'],
      destinatarios:   (row['destinatarios'] as string[] | null) ?? null,
      fechaExpiracion: (row['fecha_expiracion'] as string | null) ?? null,
      createdAt:       row['created_at'] as string,
      leida:           false,
    };
  }

  async crear(form: NotificacionForm): Promise<void> {
    const userId = this.auth.currentUser?.id;
    await supabase.from('notificaciones').insert({
      titulo:           form.titulo,
      cuerpo:           form.cuerpo,
      tipo:             form.tipo,
      destinatarios:    form.destinatarios,
      fecha_expiracion: form.fechaExpiracion,
      created_by:       userId,
    });
  }

  async actualizar(id: string, form: NotificacionForm): Promise<void> {
    await supabase.from('notificaciones').update({
      titulo:           form.titulo,
      cuerpo:           form.cuerpo,
      tipo:             form.tipo,
      destinatarios:    form.destinatarios,
      fecha_expiracion: form.fechaExpiracion,
    }).eq('id', id);
  }

  async eliminar(id: string): Promise<void> {
    await supabase.from('notificaciones').delete().eq('id', id);
  }
}
