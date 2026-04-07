export type UserRole = 'socio' | 'moderador' | 'admin';

export interface User {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  numeroSocio: string;
  avatarUrl?: string;
  rol: UserRole;
  fechaAlta: Date;
  activo: boolean;
  firstLogin: boolean;
  dni?: string;
  telefono?: string;
  direccion?: string;
  localidad: string;
  cuotaPagada?: boolean;   // estado en la temporada activa; undefined si no hay temporada
  cuotaId?: string;        // id del registro cuota para poder actualizarlo directamente
}
