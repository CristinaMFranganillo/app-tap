export interface Resultado {
  id: string;
  competicionId: string;
  userId: string;
  serie: number;
  plato: number;
  resultado: 0 | 1;
  registradoPor?: string;
  fecha: Date;
}

export interface ResumenTirador {
  userId: string;
  totalRotos: number;
  totalPlatos: number;
  porSerie: { serie: number; rotos: number }[];
}
