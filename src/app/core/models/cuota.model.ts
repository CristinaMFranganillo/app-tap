export type TipoCuota = 'socio' | 'directivo' | 'honor';

export interface Temporada {
  id: string;
  nombre: string;
  fechaInicio: Date;
  fechaFin?: Date;
  activa: boolean;
  importeSocio: number;
  importeDirectivo: number;
  importeHonor: number;
}

export interface Cuota {
  id: string;
  userId: string;
  temporadaId: string;
  temporadaNombre: string;
  pagada: boolean;
  fechaPago?: Date;
}
