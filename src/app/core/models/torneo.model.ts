export interface Torneo {
  id: string;
  nombre: string;
  fecha: string;        // 'YYYY-MM-DD'
  creadoPor: string;
  createdAt?: string;
  numEscuadras?: number;
  numTiradores?: number;
}

export interface ResultadoTorneo {
  id: string;
  escuadraId: string;
  userId?: string;
  nombreExterno?: string;
  esNoSocio: boolean;
  puesto: number;
  platosRotos: number;
}

export interface FalloTorneo {
  escuadraId: string;
  userId: string;
  numeroPlato: number;
}

export interface RankingTorneo {
  userId: string;
  nombre: string;
  apellidos: string;
  platosRotos: number;
  posicion: number;
}
