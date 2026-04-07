export interface Entrenamiento {
  id: string;
  fecha: string;        // 'YYYY-MM-DD'
  creadoPor: string;
  createdAt?: string;
  numEscuadras?: number;
}

export interface ResultadoEntrenamiento {
  id: string;
  escuadraId: string;
  userId: string;
  puesto: number;
  platosRotos: number;
}

export interface ResultadoEntrenamientoConFecha {
  id: string;
  escuadraId: string;
  entrenamientoId: string;
  userId: string;
  puesto: number;
  platosRotos: number;
  fecha: string;  // YYYY-MM-DD, de entrenamientos.fecha
}

export interface RankingEntrenamientoAnual {
  userId: string;
  mediaPlatos: number;
  totalEntrenamientos: number;
  mejorResultado: number;
}
