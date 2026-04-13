import { Injectable } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { supabase } from '../../../core/supabase/supabase.client';
import { MovimientoManual } from '../../../core/models/movimiento-manual.model';

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
}
