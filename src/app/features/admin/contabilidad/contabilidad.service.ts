import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { supabase } from '../../../core/supabase/supabase.client';
import { MovimientoManual } from '../../../core/models/movimiento-manual.model';
import { MovimientoContable } from '../../../core/models/movimiento-contable.model';

function toMovimientoManual(row: Record<string, unknown>): MovimientoManual {
  return {
    id:             row['id'] as string,
    tipo:           row['tipo'] as 'gasto' | 'ingreso',
    concepto:       row['concepto'] as string,
    importe:        row['importe'] as number,
    fecha:          row['fecha'] as string,
    registradoPor:  row['registrado_por'] as string | undefined,
    createdAt:      row['created_at'] as string | undefined,
  };
}

export interface ResumenFinanciero {
  ingresosCuotas: number;
  cuotasPagadas: number;
  cuotasTotal: number;
  ingresosEscuadras: number;
  ingresosTorneos: number;
  ingresosVarios: number;
  gastos: number;
}

@Injectable({ providedIn: 'root' })
export class ContabilidadService {

  // ── Movimientos manuales CRUD ─────────────────────────────────

  getMovimientosManuales(anio: number): Observable<MovimientoManual[]> {
    return from(
      supabase.from('movimientos_manuales').select('*')
        .gte('fecha', `${anio}-01-01`)
        .lte('fecha', `${anio}-12-31`)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data }) => (data ?? []).map(r => toMovimientoManual(r as Record<string, unknown>)))
    );
  }

  async crearMovimiento(
    tipo: 'gasto' | 'ingreso',
    concepto: string,
    importe: number,
    fecha: string,
    registradoPor: string
  ): Promise<void> {
    const { error } = await supabase.from('movimientos_manuales').insert({
      tipo,
      concepto,
      importe,
      fecha,
      registrado_por: registradoPor,
    });
    if (error) throw new Error(error.message);
  }

  async eliminarMovimiento(id: string): Promise<void> {
    const { error } = await supabase.from('movimientos_manuales').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Resumen financiero anual ──────────────────────────────────

  async getResumenAnual(anio: number, temporadaId: string | null): Promise<ResumenFinanciero> {
    const desde = `${anio}-01-01`;
    const hasta = `${anio}-12-31`;

    // Movimientos de caja (escuadras + torneos)
    const { data: movsCaja } = await supabase
      .from('movimientos_caja').select('importe, torneo_id, entrenamiento_id')
      .gte('fecha', desde).lte('fecha', hasta);

    let ingresosEscuadras = 0;
    let ingresosTorneos = 0;
    for (const row of (movsCaja ?? []) as Record<string, unknown>[]) {
      const imp = row['importe'] as number;
      if (row['torneo_id']) {
        ingresosTorneos += imp;
      } else {
        ingresosEscuadras += imp;
      }
    }

    // Cuotas pagadas de la temporada activa
    let ingresosCuotas = 0;
    let cuotasPagadas = 0;
    let cuotasTotal = 0;
    if (temporadaId) {
      const { data: cuotasData } = await supabase
        .from('cuotas')
        .select('pagada, profiles!inner(tipo_cuota)')
        .eq('temporada_id', temporadaId);

      const { data: temporadaData } = await supabase
        .from('temporadas').select('importe_socio, importe_directivo, importe_honor')
        .eq('id', temporadaId).single();

      const importes: Record<string, number> = {
        socio:     (temporadaData as any)?.importe_socio ?? 25,
        directivo: (temporadaData as any)?.importe_directivo ?? 25,
        honor:     (temporadaData as any)?.importe_honor ?? 0,
      };

      for (const row of (cuotasData ?? []) as Record<string, unknown>[]) {
        const pagada = row['pagada'] as boolean;
        const profile = row['profiles'] as Record<string, unknown>;
        const tipo = (profile?.['tipo_cuota'] as string) ?? 'socio';
        cuotasTotal++;
        if (pagada) {
          cuotasPagadas++;
          ingresosCuotas += importes[tipo] ?? 0;
        }
      }
    }

    // Movimientos manuales
    const { data: movsMan } = await supabase
      .from('movimientos_manuales').select('tipo, importe')
      .gte('fecha', desde).lte('fecha', hasta);

    let ingresosVarios = 0;
    let gastos = 0;
    for (const row of (movsMan ?? []) as Record<string, unknown>[]) {
      const imp = row['importe'] as number;
      if (row['tipo'] === 'ingreso') ingresosVarios += imp;
      else gastos += imp;
    }

    return {
      ingresosCuotas,
      cuotasPagadas,
      cuotasTotal,
      ingresosEscuadras,
      ingresosTorneos,
      ingresosVarios,
      gastos,
    };
  }

  // ── Contabilidad por período ─────────────────────────────────

  private async getMovimientosContables(desde: string, hasta: string): Promise<MovimientoContable[]> {
    const [resCaja, resManuales, resCuotas] = await Promise.all([
      supabase.from('movimientos_caja').select('id, torneo_id, nombre_tirador, importe, fecha')
        .gte('fecha', desde).lte('fecha', hasta),

      supabase.from('movimientos_manuales').select('id, tipo, concepto, importe, fecha')
        .gte('fecha', desde).lte('fecha', hasta),

      supabase.from('cuotas')
        .select('id, fecha_pago, profiles!inner(nombre, apellidos, tipo_cuota), temporadas!inner(importe_socio, importe_directivo, importe_honor)')
        .eq('pagada', true)
        .gte('fecha_pago', `${desde}T00:00:00`)
        .lte('fecha_pago', `${hasta}T23:59:59`),
    ]);

    const movimientos: MovimientoContable[] = [];

    for (const row of (resCaja.data ?? []) as Record<string, unknown>[]) {
      const esTorneo = !!row['torneo_id'];
      movimientos.push({
        id: row['id'] as string,
        categoria: esTorneo ? 'torneo' : 'escuadra',
        concepto: row['nombre_tirador'] as string,
        importe: row['importe'] as number,
        esGasto: false,
        fecha: row['fecha'] as string,
      });
    }

    for (const row of (resManuales.data ?? []) as Record<string, unknown>[]) {
      const tipo = row['tipo'] as string;
      movimientos.push({
        id: row['id'] as string,
        categoria: tipo === 'gasto' ? 'gasto_manual' : 'ingreso_manual',
        concepto: row['concepto'] as string,
        importe: row['importe'] as number,
        esGasto: tipo === 'gasto',
        fecha: row['fecha'] as string,
      });
    }

    for (const row of (resCuotas.data ?? []) as Record<string, unknown>[]) {
      const profile = row['profiles'] as Record<string, unknown>;
      const temporada = row['temporadas'] as Record<string, unknown>;
      const tipoCuota = (profile['tipo_cuota'] as string) ?? 'socio';
      const importeKey = `importe_${tipoCuota}` as string;
      const importe = (temporada[importeKey] as number) ?? 0;
      const nombre = `${profile['nombre']} ${profile['apellidos']}`;
      const fechaPago = new Date(row['fecha_pago'] as string).toISOString().split('T')[0];

      movimientos.push({
        id: row['id'] as string,
        categoria: 'cuota',
        concepto: `Cuota — ${nombre}`,
        importe,
        esGasto: false,
        fecha: fechaPago,
      });
    }

    movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return movimientos;
  }

  async getContabilidadDia(fecha: string): Promise<MovimientoContable[]> {
    return this.getMovimientosContables(fecha, fecha);
  }

  async getContabilidadMes(mes: string): Promise<MovimientoContable[]> {
    const [y, m] = mes.split('-');
    const desde = `${y}-${m}-01`;
    const hasta = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
    return this.getMovimientosContables(desde, hasta);
  }

  async getContabilidadAnio(anio: number): Promise<MovimientoContable[]> {
    return this.getMovimientosContables(`${anio}-01-01`, `${anio}-12-31`);
  }
}
