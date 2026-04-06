export interface Competicion {
  id: string;
  nombre: string;
  modalidad: string;
  totalPlatos: number;
  fecha: Date;
  activa: boolean;
  creadaPor: string;
}
