import { Injectable } from '@angular/core';
import { from, Observable, map, tap, BehaviorSubject } from 'rxjs';
import { User, UserRole } from '../../../core/models/user.model';
import { supabase } from '../../../core/supabase/supabase.client';

function toUser(row: Record<string, unknown>): User {
  return {
    id: row['id'] as string,
    nombre: row['nombre'] as string,
    apellidos: row['apellidos'] as string,
    email: (row['email'] as string) ?? '',
    numeroSocio: row['numero_socio'] as string,
    avatarUrl: (row['avatar_url'] as string) ?? undefined,
    rol: row['rol'] as UserRole,
    fechaAlta: new Date(row['fecha_alta'] as string),
    activo: row['activo'] as boolean,
    firstLogin: (row['first_login'] as boolean) ?? true,
    dni: (row['dni'] as string) ?? undefined,
    telefono: (row['telefono'] as string) ?? undefined,
    direccion: (row['direccion'] as string) ?? undefined,
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

  async update(id: string, data: Partial<User>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.nombre !== undefined) payload['nombre'] = data.nombre;
    if (data.apellidos !== undefined) payload['apellidos'] = data.apellidos;
    if (data.numeroSocio !== undefined) payload['numero_socio'] = data.numeroSocio;
    if (data.rol !== undefined) payload['rol'] = data.rol;
    if (data.avatarUrl !== undefined) payload['avatar_url'] = data.avatarUrl;
    if (data.activo !== undefined) payload['activo'] = data.activo;
    if (data.dni !== undefined) payload['dni'] = data.dni;
    if (data.telefono !== undefined) payload['telefono'] = data.telefono;
    if (data.direccion !== undefined) payload['direccion'] = data.direccion;
    if (data.email !== undefined) payload['email'] = data.email;
    const { error } = await supabase.from('profiles').update(payload).eq('id', id);
    if (error) throw new Error(error.message ?? 'Error al actualizar el perfil');
    const current = this.cache.getValue();
    this.cache.next(current.map(u => u.id === id ? { ...u, ...data } : u));
  }

  async toggleActivo(id: string): Promise<void> {
    const user = this.getById(id);
    if (user) {
      await this.update(id, { activo: !user.activo });
    }
  }

  async crearEnAuth(data: {
    nombre: string;
    apellidos: string;
    email: string;
    rol: UserRole;
    numeroSocio: string;
    dni?: string;
    telefono?: string;
    direccion?: string;
  }): Promise<void> {
    const { error } = await supabase.functions.invoke('crear-usuario', { body: data });
    if (error) throw new Error('Error al crear el usuario.');
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await supabase.functions.invoke('eliminar-usuario', { body: { userId: id } });
    if (error) throw new Error('Error al eliminar el usuario.');
    const current = this.cache.getValue();
    this.cache.next(current.filter(u => u.id !== id));
  }

  async setFirstLoginDone(id: string): Promise<void> {
    await supabase.from('profiles').update({ first_login: false }).eq('id', id);
  }
}
