export interface InscripcionTorneo {
  id: string;
  torneoId: string;
  userId?: string;
  nombre?: string;
  apellidos?: string;
  esNoSocio: boolean;
  precioPagado: number;
  creadoPor?: string;
  createdAt: string;
}

export interface InscritoVista {
  id: string;
  esNoSocio: boolean;
  userId?: string;
  nombre: string;
  apellidos: string;
  precioPagado: number;
  enEscuadra: boolean;
}
