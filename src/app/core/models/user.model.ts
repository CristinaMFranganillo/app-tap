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
}
