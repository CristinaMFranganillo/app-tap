export interface Competicion {
  id: string;
  nombre: string;
  modalidad: string;
  platosPorSerie: number;
  numSeries: number;
  lugar?: string;
  fecha: Date;
  activa: boolean;
  creadaPor: string;
}
