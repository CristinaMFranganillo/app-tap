export interface Escuadra {
  id: string;
  competicionId?: string;
  entrenamientoId?: string;
  torneoId?: string;
  numero: number;
  tiradores?: EscuadraTirador[];
}

export interface EscuadraTirador {
  id: string;
  escuadraId: string;
  userId?: string;           // null si es no socio
  nombreExterno?: string;    // nombre del no socio
  esNoSocio: boolean;
  puesto: number;
}

// ── Contabilidad ─────────────────────────────────────────────────────────────

export interface Tarifa {
  id: string;
  tipo: 'socio' | 'no_socio';
  importe: number;
}

export interface MovimientoCaja {
  id: string;
  entrenamientoId?: string;
  escuadraId?: string;
  torneoId?: string;
  userId?: string;
  nombreTirador: string;
  esNoSocio: boolean;
  importe: number;
  fecha: string;             // 'YYYY-MM-DD'
  registradoPor?: string;
}
