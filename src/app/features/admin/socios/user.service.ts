import { Injectable } from '@angular/core';
import { from, Observable, map, tap, BehaviorSubject } from 'rxjs';
import { User, UserRole } from '../../../core/models/user.model';
import { supabase } from '../../../core/supabase/supabase.client';

function normalizeNumeroSocio(raw: unknown): number {
  const n = Number(raw);
  return isNaN(n) ? 0 : n;
}

function normalizeRol(raw: unknown): UserRole {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'admin' || s === 'moderador' || s === 'socio') return s;
  return 'socio';
}

function toUser(row: Record<string, unknown>): User {
  const cuotaRows = (row['cuotas'] as Record<string, unknown>[] | null) ?? [];
  const cuota = cuotaRows[0] ?? null;

  return {
    id:          row['id'] as string,
    nombre:      row['nombre'] as string,
    apellidos:   row['apellidos'] as string,
    email:       (row['email'] as string) ?? '',
    numeroSocio: normalizeNumeroSocio(row['numero_socio']),
    avatarUrl:   (row['avatar_url'] as string) ?? undefined,
    rol:         normalizeRol(row['rol']),
    fechaAlta:   new Date(row['fecha_alta'] as string),
    activo:      row['activo'] as boolean,
    firstLogin:  (row['first_login'] as boolean) ?? true,
    dni:         (row['dni'] as string) ?? undefined,
    telefono:    (row['telefono'] as string) ?? undefined,
    direccion:   (row['direccion'] as string) ?? undefined,
    localidad:   (row['localidad'] as string) ?? '',
    tipoCuota:   (row['tipo_cuota'] as 'socio' | 'directivo' | 'honor') ?? 'socio',
    cuotaPagada: cuota ? (cuota['pagada'] as boolean) : undefined,
    cuotaId:     cuota ? (cuota['id'] as string) : undefined,
    favorito:    (row['favorito'] as boolean) ?? false,
  };
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private cache = new BehaviorSubject<User[]>([]);

  getAll(): Observable<User[]> {
    return from(
      (async () => {
        const { data: season } = await supabase
          .from('temporadas')
          .select('id')
          .eq('activa', true)
          .maybeSingle();

        let query = supabase
          .from('profiles')
          .select(
            'id,nombre,apellidos,email,numero_socio,avatar_url,rol,fecha_alta,activo,first_login,dni,telefono,direccion,localidad,tipo_cuota,favorito,cuotas!left(id, pagada, temporada_id)'
          )
          .eq('rol', 'socio')
          .order('numero_socio', { ascending: true });

        if (season?.id) {
          query = query.or(`temporada_id.eq.${season.id},temporada_id.is.null`, { referencedTable: 'cuotas' });
        }

        const [{ data }, idsConHistorial] = await Promise.all([
          query,
          this._getIdsConHistorial(),
        ]);
        return { rows: data ?? [], idsConHistorial };
      })()
    ).pipe(
      map(({ rows, idsConHistorial }) =>
        rows.map(row => {
          const user = toUser(row as Record<string, unknown>);
          user.tieneHistorial = idsConHistorial.has(user.id);
          return user;
        })
      ),
      tap(users => this.cache.next(users))
    );
  }

  private async _getIdsConHistorial(): Promise<Set<string>> {
    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      supabase.from('escuadra_tiradores').select('user_id'),
      supabase.from('resultados_entrenamiento').select('user_id'),
    ]);
    const ids = new Set<string>();
    (d1 ?? []).forEach((r: { user_id: string }) => ids.add(r.user_id));
    (d2 ?? []).forEach((r: { user_id: string }) => ids.add(r.user_id));
    return ids;
  }

  getById(id: string): User | undefined {
    return this.cache.getValue().find(u => u.id === id);
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (data.nombre      !== undefined) payload['nombre']       = data.nombre;
    if (data.apellidos   !== undefined) payload['apellidos']    = data.apellidos;
    if (data.numeroSocio !== undefined) payload['numero_socio'] = data.numeroSocio;
    if (data.rol         !== undefined) payload['rol']          = data.rol;
    if (data.avatarUrl   !== undefined) payload['avatar_url']   = data.avatarUrl;
    if (data.activo      !== undefined) payload['activo']       = data.activo;
    if (data.dni         !== undefined) payload['dni']          = data.dni;
    if (data.telefono    !== undefined) payload['telefono']     = data.telefono;
    if (data.direccion   !== undefined) payload['direccion']    = data.direccion;
    if (data.localidad   !== undefined) payload['localidad']    = data.localidad;
    if (data.tipoCuota   !== undefined) payload['tipo_cuota']   = data.tipoCuota;
    if (data.email       !== undefined) payload['email']        = data.email;
    if (data.favorito    !== undefined) payload['favorito']     = data.favorito;

    const { error } = await supabase.from('profiles').update(payload).eq('id', id);
    if (error) throw new Error(error.message ?? 'Error al actualizar el perfil');

    const current = this.cache.getValue();
    this.cache.next(current.map(u => u.id === id ? { ...u, ...data } : u));
  }

  async toggleActivo(id: string): Promise<void> {
    const user = this.getById(id);
    if (user) await this.update(id, { activo: !user.activo });
  }

  async desactivarSocio(id: string): Promise<void> {
    await this.update(id, { activo: false });
  }

  async toggleFavorito(id: string): Promise<void> {
    const user = this.getById(id);
    if (!user) return;
    const nuevoValor = !user.favorito;
    const { error } = await supabase.from('profiles').update({ favorito: nuevoValor }).eq('id', id);
    if (error) throw new Error(error.message);
    const current = this.cache.getValue();
    this.cache.next(current.map(u => u.id === id ? { ...u, favorito: nuevoValor } : u));
  }

  async crearEnAuth(data: {
    nombre: string;
    apellidos: string;
    email: string;
    rol: UserRole;
    numeroSocio: number;
    dni?: string;
    telefono?: string;
    direccion?: string;
    localidad?: string;
    tipoCuota?: 'socio' | 'directivo' | 'honor';
  }): Promise<void> {
    const { data: result, error } = await supabase.functions.invoke('crear-usuario', { body: data });
    if (error) throw new Error(error.message ?? 'Error al crear el usuario.');
    if (result?.error) throw new Error(result.error);
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
