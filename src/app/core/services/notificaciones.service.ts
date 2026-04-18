// src/app/core/services/notificaciones.service.ts
import { Injectable, computed, signal } from '@angular/core';
import { supabase } from '../supabase/supabase.client';
import { Notificacion } from '../models/notificacion.model';
import type { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  notificaciones = signal<Notificacion[]>([]);
  noLeidas = computed(() => this.notificaciones().filter(n => !n.leida).length);

  private canal: RealtimeChannel | null = null;

  async cargar(): Promise<void> {
    const { data, error } = await supabase
      .from('notificaciones')
      .select(`
        id, titulo, cuerpo, tipo, destinatarios, fecha_expiracion, created_at,
        notificaciones_leidas!left(user_id)
      `)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    const userId = (await supabase.auth.getUser()).data.user?.id;

    const mapeadas: Notificacion[] = data.map((row: Record<string, unknown>) => ({
      id:              row['id'] as string,
      titulo:          row['titulo'] as string,
      cuerpo:          row['cuerpo'] as string,
      tipo:            row['tipo'] as Notificacion['tipo'],
      destinatarios:   (row['destinatarios'] as string[] | null) ?? null,
      fechaExpiracion: (row['fecha_expiracion'] as string | null) ?? null,
      createdAt:       row['created_at'] as string,
      leida:           Array.isArray(row['notificaciones_leidas']) &&
                       (row['notificaciones_leidas'] as Array<{ user_id: string }>)
                         .some(l => l.user_id === userId),
    }));

    this.notificaciones.set(mapeadas);
  }

  suscribirRealtime(): RealtimeChannel {
    if (this.canal) {
      supabase.removeChannel(this.canal);
      this.canal = null;
    }
    this.canal = supabase
      .channel('notificaciones-nuevas')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones' },
        async () => {
          await this.cargar();
        }
      )
      .subscribe();

    return this.canal;
  }

  async marcarLeida(id: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    await supabase.from('notificaciones_leidas').insert({ notificacion_id: id, user_id: userId });

    this.notificaciones.update(lista =>
      lista.map(n => n.id === id ? { ...n, leida: true } : n)
    );
  }

  async marcarTodasLeidas(): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    const noLeidas = this.notificaciones().filter(n => !n.leida);
    if (noLeidas.length === 0) return;

    const rows = noLeidas.map(n => ({ notificacion_id: n.id, user_id: userId }));
    await supabase.from('notificaciones_leidas').insert(rows);

    this.notificaciones.update(lista => lista.map(n => ({ ...n, leida: true })));
  }

  limpiar(): void {
    if (this.canal) {
      supabase.removeChannel(this.canal);
      this.canal = null;
    }
    this.notificaciones.set([]);
  }
}
