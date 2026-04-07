export interface Entrenamiento {
  id: string;
  fecha: string;        // 'YYYY-MM-DD'
  creadoPor: string;
  createdAt?: string;
  numEscuadras?: number;
  numTiradores?: number;
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

// Agrupación por fecha para la tabla del admin
export interface EntrenamientoDia {
  fecha: string;         // 'YYYY-MM-DD' — clave única de la fila
  ids: string[];         // IDs de todos los entrenamientos de ese día
  numEscuadras: number;
  numTiradores: number;
}

export interface RankingEntrenamientoAnual {
  userId: string;
  mediaPlatos: number;
  totalEntrenamientos: number;
  mejorResultado: number;
}
