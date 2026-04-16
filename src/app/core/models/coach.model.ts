export interface CoachInforme {
  id: string;
  userId: string;
  contenido: string;
  createdAt: string;
}

export interface MensajeChat {
  rol: 'user' | 'model';
  texto: string;
}

export interface ContextoCoach {
  fallosPorPlato: { plato: number; veces: number }[];
  rendimientoPorEsquema: { esquema: number; media: number; sesiones: number }[];
  evolucionMensual: { mes: number; media: number | null }[];
  torneoProximo: { nombre: string; fecha: string } | null;
  proximaEscuadra: { fecha: string; esquema: number } | null;
  historialCompeticion: { fecha: string; platosRotos: number }[];
}
