export interface Temporada {
  id: string;
  nombre: string;
  fechaInicio: Date;
  fechaFin?: Date;
  activa: boolean;
}

export interface Cuota {
  id: string;
  userId: string;
  temporadaId: string;
  temporadaNombre: string;
  pagada: boolean;
  fechaPago?: Date;
}
