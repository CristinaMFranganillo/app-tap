import { Injectable } from '@angular/core';
import { from, Observable, map, tap, BehaviorSubject } from 'rxjs';
import { User, UserRole } from '../../../core/models/user.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toUser(row: Record<string, unknown>): User {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    apellidos: row['apellidos'] as string,
    email: '',
    numeroSocio: row['numero_socio'] as string,
    avatarUrl: (row['avatar_url'] as string) ?? undefined,
    rol: row['rol'] as UserRole,
    fechaAlta: new Date(row['fecha_alta'] as string),
    activo: row['activo'] as boolean,
  };
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private cache = new BehaviorSubject<User[]>([]);

  getAll(): Observable<User[]> {
    return from(
      supabase.from('profiles').select('*').order('fecha_alta', { ascending: true })
    ).pipe(
      map(({ data }) => (data ?? []).map(toUser)),
      tap(users => this.cache.next(users))
    );
  }

  getById(id: string): User | undefined {
    return this.cache.getValue().find(u => u.id === id);
  }

  async create(data: Omit<User, 'id'>): Promise<void> {
    const payload: Record<string, unknown> = {
      nombre: data.nombre,
      apellidos: data.apellidos,
      numero_socio: data.numeroSocio,
      rol: data.rol,
      fecha_alta: data.fechaAlta.toISOString(),
      activo: data.activo,
    };
    if (data.avatarUrl !== undefined) payload['avatar_url'] = data.avatarUrl;
    const { data: created } = await supabase.from('profiles').insert([payload]).select();
    if (created && created.length > 0) {
      const newUser = toUser(created[0]);
      const current = this.cache.getValue();
      this.cache.next([...current, newUser]);
    }
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.nombre !== undefined) payload['nombre'] = data.nombre;
    if (data.apellidos !== undefined) payload['apellidos'] = data.apellidos;
    if (data.numeroSocio !== undefined) payload['numero_socio'] = data.numeroSocio;
    if (data.rol !== undefined) payload['rol'] = data.rol;
    if (data.avatarUrl !== undefined) payload['avatar_url'] = data.avatarUrl;
    if (data.activo !== undefined) payload['activo'] = data.activo;
    await supabase.from('profiles').update(payload).eq('id', id);
    // Actualizar cache local
    const current = this.cache.getValue();
    this.cache.next(current.map(u => u.id === id ? { ...u, ...data } : u));
  }

  async toggleActivo(id: string): Promise<void> {
    const user = this.getById(id);
    if (user) {
      await this.update(id, { activo: !user.activo });
    }
  }
}
