export type CategoriaContable =
  'escuadra' | 'torneo' | 'cuota' | 'ingreso_manual' | 'gasto_manual';

export interface MovimientoContable {
  id: string;
  categoria: CategoriaContable;
  concepto: string;
  importe: number;         // siempre positivo
  esGasto: boolean;        // true solo para gasto_manual
  fecha: string;           // 'YYYY-MM-DD'
}

export interface ResumenContable {
  ingresos: number;
  gastos: number;
  balance: number;
  countIngresos: number;
  countGastos: number;
}

export interface GrupoDiaContable {
  fecha: string;
  movimientos: MovimientoContable[];
  ingresos: number;
  gastos: number;
  balance: number;
  countIngresos: number;
  countGastos: number;
}

export interface GrupoMesContable {
  mes: string;             // 'YYYY-MM'
  label: string;           // 'abril 2026'
  ingresos: number;
  gastos: number;
  balance: number;
  countIngresos: number;
  countGastos: number;
}

export interface DesgloseCategoria {
  escuadras: number;
  torneos: number;
  cuotas: number;
  ingresosVarios: number;
  gastos: number;
}
