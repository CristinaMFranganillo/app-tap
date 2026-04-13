export type TipoMovimientoManual = 'gasto' | 'ingreso';

export interface MovimientoManual {
  id: string;
  tipo: TipoMovimientoManual;
  concepto: string;
  importe: number;
  fecha: string;           // 'YYYY-MM-DD'
  registradoPor?: string;
  createdAt?: string;
}
