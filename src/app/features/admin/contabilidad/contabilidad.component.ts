import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContabilidadService } from './contabilidad.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  MovimientoContable,
  ResumenContable,
  GrupoDiaContable,
  GrupoMesContable,
  DesgloseCategoria,
} from '../../../core/models/movimiento-contable.model';

type VistaMode = 'dia' | 'mes' | 'anio';

@Component({
  selector: 'app-contabilidad',
  standalone: true,
  imports: [DecimalPipe, DatePipe, TitleCasePipe, FormsModule],
  templateUrl: './contabilidad.component.html',
  styleUrl: './contabilidad.component.scss',
})
export class ContabilidadComponent {
  private contabilidadService = inject(ContabilidadService);
  private authService = inject(AuthService);
  private router = inject(Router);

  vista = signal<VistaMode>('dia');
  cargando = signal(true);
  movimientos = signal<MovimientoContable[]>([]);

  fechaDia = signal(new Date().toISOString().split('T')[0]);
  mesFiltro = signal(this.mesActual());
  anioFiltro = signal(new Date().getFullYear());

  origenDrillDown = signal<'mes' | 'anio' | null>(null);

  // CRUD
  mostrarFormMovimiento = signal(false);
  tipoMovimiento = signal<'gasto' | 'ingreso'>('gasto');
  nuevoConcepto = '';
  nuevoImporte: number | null = null;
  nuevoFecha = new Date().toISOString().split('T')[0];
  guardando = signal(false);
  error = signal('');

  // ── Computed ──────────────────────────────────────────────────────

  resumen = computed<ResumenContable>(() => {
    const movs = this.movimientos();
    const ingresos = movs.filter(m => !m.esGasto).reduce((s, m) => s + m.importe, 0);
    const gastos = movs.filter(m => m.esGasto).reduce((s, m) => s + m.importe, 0);
    return {
      ingresos,
      gastos,
      balance: ingresos - gastos,
      countIngresos: movs.filter(m => !m.esGasto).length,
      countGastos: movs.filter(m => m.esGasto).length,
    };
  });

  agrupadoPorDia = computed<GrupoDiaContable[]>(() => {
    const mapa = new Map<string, GrupoDiaContable>();
    for (const m of this.movimientos()) {
      if (!mapa.has(m.fecha)) {
        mapa.set(m.fecha, {
          fecha: m.fecha,
          movimientos: [],
          ingresos: 0,
          gastos: 0,
          balance: 0,
          countIngresos: 0,
          countGastos: 0,
        });
      }
      const g = mapa.get(m.fecha)!;
      g.movimientos.push(m);
      if (m.esGasto) {
        g.gastos += m.importe;
        g.countGastos++;
      } else {
        g.ingresos += m.importe;
        g.countIngresos++;
      }
      g.balance = g.ingresos - g.gastos;
    }
    return Array.from(mapa.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  agrupadoPorMes = computed<GrupoMesContable[]>(() => {
    const mapa = new Map<string, GrupoMesContable>();
    for (const m of this.movimientos()) {
      const mes = m.fecha.substring(0, 7);
      if (!mapa.has(mes)) {
        mapa.set(mes, {
          mes,
          label: this.labelMes(mes),
          ingresos: 0,
          gastos: 0,
          balance: 0,
          countIngresos: 0,
          countGastos: 0,
        });
      }
      const g = mapa.get(mes)!;
      if (m.esGasto) {
        g.gastos += m.importe;
        g.countGastos++;
      } else {
        g.ingresos += m.importe;
        g.countIngresos++;
      }
      g.balance = g.ingresos - g.gastos;
    }
    return Array.from(mapa.values()).sort((a, b) => b.mes.localeCompare(a.mes));
  });

  desgloseCategoria = computed<DesgloseCategoria>(() => {
    const movs = this.movimientos();
    return {
      escuadras: movs.filter(m => m.categoria === 'escuadra').reduce((s, m) => s + m.importe, 0),
      torneos: movs.filter(m => m.categoria === 'torneo').reduce((s, m) => s + m.importe, 0),
      cuotas: movs.filter(m => m.categoria === 'cuota').reduce((s, m) => s + m.importe, 0),
      ingresosVarios: movs.filter(m => m.categoria === 'ingreso_manual').reduce((s, m) => s + m.importe, 0),
      gastos: movs.filter(m => m.categoria === 'gasto_manual').reduce((s, m) => s + m.importe, 0),
    };
  });

  esAdmin = computed(() => this.authService.currentUser?.rol === 'admin');

  // ── Init ──────────────────────────────────────────────────────────

  constructor() {
    void this.cargarDia(this.fechaDia());
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private mesActual(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  mesesDisponibles(): string[] {
    const meses: string[] = [];
    const hoy = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return meses;
  }

  aniosDisponibles(): number[] {
    const hoy = new Date().getFullYear();
    return [hoy, hoy - 1, hoy - 2];
  }

  labelMes(mes: string): string {
    const [y, m] = mes.split('-');
    return new Date(Number(y), Number(m) - 1, 1)
      .toLocaleDateString('es', { month: 'long', year: 'numeric' });
  }

  labelCategoria(cat: string): string {
    const labels: Record<string, string> = {
      escuadra: 'Escuadra',
      torneo: 'Torneo',
      cuota: 'Cuota',
      ingreso_manual: 'Ingreso',
      gasto_manual: 'Gasto',
    };
    return labels[cat] ?? cat;
  }

  // ── Navegación de vistas ──────────────────────────────────────────

  async setVista(v: VistaMode): Promise<void> {
    this.origenDrillDown.set(null);
    this.vista.set(v);
    if (v === 'dia') await this.cargarDia(this.fechaDia());
    if (v === 'mes') await this.cargarMes(this.mesFiltro());
    if (v === 'anio') await this.cargarAnio(this.anioFiltro());
  }

  // ── Drill-down ────────────────────────────────────────────────────

  async drillDownMes(mes: string): Promise<void> {
    this.origenDrillDown.set('anio');
    this.vista.set('mes');
    await this.cargarMes(mes);
  }

  async drillDownDia(fecha: string): Promise<void> {
    this.origenDrillDown.set('mes');
    this.vista.set('dia');
    await this.cargarDia(fecha);
  }

  goBack(): void {
    const origen = this.origenDrillDown();
    if (origen === 'mes') {
      this.origenDrillDown.set('anio');
      this.vista.set('mes');
      void this.cargarMes(this.mesFiltro());
    } else if (origen === 'anio') {
      this.origenDrillDown.set(null);
      this.vista.set('anio');
      void this.cargarAnio(this.anioFiltro());
    } else {
      this.router.navigate(['/perfil']);
    }
  }

  // ── Carga de datos ────────────────────────────────────────────────

  async cargarDia(fecha: string): Promise<void> {
    this.fechaDia.set(fecha);
    this.cargando.set(true);
    try {
      this.movimientos.set(await this.contabilidadService.getContabilidadDia(fecha));
    } finally { this.cargando.set(false); }
  }

  async cargarMes(mes: string): Promise<void> {
    this.mesFiltro.set(mes);
    this.cargando.set(true);
    try {
      this.movimientos.set(await this.contabilidadService.getContabilidadMes(mes));
    } finally { this.cargando.set(false); }
  }

  async cargarAnio(anio: number): Promise<void> {
    this.anioFiltro.set(anio);
    this.cargando.set(true);
    try {
      this.movimientos.set(await this.contabilidadService.getContabilidadAnio(anio));
    } finally { this.cargando.set(false); }
  }

  // ── CRUD movimientos manuales ─────────────────────────────────────

  abrirFormMovimiento(tipo: 'gasto' | 'ingreso'): void {
    this.tipoMovimiento.set(tipo);
    this.nuevoConcepto = '';
    this.nuevoImporte = null;
    this.nuevoFecha = new Date().toISOString().split('T')[0];
    this.mostrarFormMovimiento.set(true);
  }

  cancelarFormMovimiento(): void {
    this.mostrarFormMovimiento.set(false);
  }

  async guardarMovimiento(): Promise<void> {
    const concepto = this.nuevoConcepto.trim();
    if (!concepto || !this.nuevoImporte || this.nuevoImporte <= 0) return;
    const me = this.authService.currentUser;
    if (!me) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.contabilidadService.crearMovimiento(
        this.tipoMovimiento(),
        concepto,
        this.nuevoImporte,
        this.nuevoFecha,
        me.id
      );
      this.mostrarFormMovimiento.set(false);
      await this.recargarVistaActual();
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarMovimiento(mov: MovimientoContable): Promise<void> {
    if (!confirm(`¿Eliminar ${mov.esGasto ? 'gasto' : 'ingreso'}: "${mov.concepto}"?`)) return;
    this.error.set('');
    try {
      await this.contabilidadService.eliminarMovimiento(mov.id);
      await this.recargarVistaActual();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  esMovimientoManual(mov: MovimientoContable): boolean {
    return mov.categoria === 'gasto_manual' || mov.categoria === 'ingreso_manual';
  }

  private async recargarVistaActual(): Promise<void> {
    const v = this.vista();
    if (v === 'dia') await this.cargarDia(this.fechaDia());
    if (v === 'mes') await this.cargarMes(this.mesFiltro());
    if (v === 'anio') await this.cargarAnio(this.anioFiltro());
  }
}
