import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { News } from '../../core/models/news.model';
import { supabase } from '../../core/supabase/supabase.client';

function toNews(row: Record<string, unknown>): News {
  return {
    id: row['id'] as string,
    titulo: row['titulo'] as string,
    contenido: row['contenido'] as string,
    autorId: row['autor_id'] as string,
    fecha: new Date(row['fecha'] as string),
    imagenUrl: (row['imagen_url'] as string) ?? undefined,
    publicada: row['publicada'] as boolean,
  };
}

@Injectable({ providedIn: 'root' })
export class NewsService {

  getAll(): Observable<News[]> {
    return from(
      supabase.from('noticias').select('*').order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toNews)));
  }

  getPublicadas(): Observable<News[]> {
    return from(
      supabase.from('noticias').select('*').eq('publicada', true).order('fecha', { ascending: false })
    ).pipe(map(({ data }) => (data ?? []).map(toNews)));
  }

  async getById(id: string): Promise<News | null> {
    const { data } = await supabase.from('noticias').select('*').eq('id', id).single();
    return data ? toNews(data as Record<string, unknown>) : null;
  }

  async create(data: Omit<News, 'id'>): Promise<void> {
    await supabase.from('noticias').insert({
      titulo: data.titulo,
      contenido: data.contenido,
      autor_id: data.autorId,
      fecha: data.fecha.toISOString(),
      imagen_url: data.imagenUrl ?? null,
      publicada: data.publicada,
    });
  }

  async update(id: string, data: Partial<News>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.titulo !== undefined) payload['titulo'] = data.titulo;
    if (data.contenido !== undefined) payload['contenido'] = data.contenido;
    if (data.publicada !== undefined) payload['publicada'] = data.publicada;
    if (data.imagenUrl !== undefined) payload['imagen_url'] = data.imagenUrl;
    await supabase.from('noticias').update(payload).eq('id', id);
  }

  async delete(id: string): Promise<void> {
    await supabase.from('noticias').delete().eq('id', id);
  }
}
