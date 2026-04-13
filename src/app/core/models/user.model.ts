export type UserRole = 'socio' | 'moderador' | 'admin';

export type TipoCuota = 'socio' | 'directivo' | 'honor';

export interface User {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  numeroSocio: number;        // integer en BD
  avatarUrl?: string;
  rol: UserRole;
  fechaAlta: Date;
  activo: boolean;
  firstLogin: boolean;
  dni?: string;
  telefono?: string;
  direccion?: string;
  localidad: string;
  tipoCuota: TipoCuota;
  cuotaPagada?: boolean;
  cuotaId?: string;
  favorito: boolean;
  tieneHistorial?: boolean;
}
