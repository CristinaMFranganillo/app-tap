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
