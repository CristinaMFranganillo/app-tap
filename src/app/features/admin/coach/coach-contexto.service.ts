import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { supabase } from '../../../core/supabase/supabase.client';
import { CoachContexto, CoachContextoForm } from '../../../core/models/coach.model';

@Injectable({ providedIn: 'root' })
export class CoachContextoService {

  getAll(): Observable<CoachContexto[]> {
    return from(
      supabase
        .from('coach_contexto')
        .select('*')
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map(this.mapRow);
      })
    );
  }

  async crear(form: CoachContextoForm, createdBy: string): Promise<void> {
    const { error } = await supabase.from('coach_contexto').insert({
      titulo: form.titulo,
      contenido: form.contenido,
      categoria: form.categoria,
      activo: form.activo,
      fecha_expiracion: form.fechaExpiracion ?? null,
      created_by: createdBy,
    });
    if (error) throw error;
  }

  async actualizar(id: string, form: Partial<CoachContextoForm>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (form.titulo !== undefined)          payload['titulo']           = form.titulo;
    if (form.contenido !== undefined)       payload['contenido']        = form.contenido;
    if (form.categoria !== undefined)       payload['categoria']        = form.categoria;
    if (form.activo !== undefined)          payload['activo']           = form.activo;
    if (form.fechaExpiracion !== undefined) payload['fecha_expiracion'] = form.fechaExpiracion ?? null;

    const { error } = await supabase.from('coach_contexto').update(payload).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await supabase.from('coach_contexto').delete().eq('id', id);
    if (error) throw error;
  }

  async getById(id: string): Promise<CoachContexto | null> {
    const { data, error } = await supabase
      .from('coach_contexto')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return this.mapRow(data);
  }

  private mapRow(row: Record<string, unknown>): CoachContexto {
    return {
      id:              row['id'] as string,
      titulo:          row['titulo'] as string,
      contenido:       row['contenido'] as string,
      categoria:       row['categoria'] as CoachContexto['categoria'],
      activo:          row['activo'] as boolean,
      fechaExpiracion: row['fecha_expiracion'] as string | null,
      createdBy:       row['created_by'] as string,
      createdAt:       row['created_at'] as string,
    };
  }
}
