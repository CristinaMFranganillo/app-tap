import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../features/scores/escuadra.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MovimientoCaja } from '../../../core/models/escuadra.model';

type VistaMode = 'dia' | 'mes' | 'anio';

interface GrupoEscuadra {
  escuadraId: string;
  numero: number;
  movimientos: MovimientoCaja[];
  total: number;
}

interface GrupoDia {
  fecha: string;
  movimientos: MovimientoCaja[];
  total: number;
  countNoSocios: number;
}

interface ResumenPeriodo {
  totalSocios: number;
  totalNoSocios: number;
  totalGeneral: number;
  countSocios: number;
  countNoSocios: number;
}

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [DecimalPipe, DatePipe, TitleCasePipe, FormsModule],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.scss',
})
export class CajaComponent {
  private escuadraService = inject(EscuadraService);
  private authService     = inject(AuthService);
  private router          = inject(Router);

  vista       = signal<VistaMode>('dia');
  cargando    = signal(true);
  movimientos = signal<MovimientoCaja[]>([]);

  fechaDia   = signal(new Date().toISOString().split('T')[0]);
  mesFiltro  = signal(this.mesActual());
  anioFiltro = signal(new Date().getFullYear());

  // ── Computed ──────────────────────────────────────────────────────────────

  resumen = computed<ResumenPeriodo>(() => {
    const movs = this.movimientos();
    return {
      totalSocios:   movs.filter(m => !m.esNoSocio).reduce((s, m) => s + m.importe, 0),
      totalNoSocios: movs.filter(m =>  m.esNoSocio).reduce((s, m) => s + m.importe, 0),
      totalGeneral:  movs.reduce((s, m) => s + m.importe, 0),
      countSocios:   movs.filter(m => !m.esNoSocio).length,
      countNoSocios: movs.filter(m =>  m.esNoSocio).length,
    };
  });

  // Desglose por fecha para vistas mes/anio — el conteo de no socios se precalcula aquí
  agrupadoPorFecha = computed<GrupoDia[]>(() => {
    const mapa = new Map<string, GrupoDia>();
    for (const m of this.movimientos()) {
      if (!mapa.has(m.fecha))
        mapa.set(m.fecha, { fecha: m.fecha, movimientos: [], total: 0, countNoSocios: 0 });
      const g = mapa.get(m.fecha)!;
      g.movimientos.push(m);
      g.total += m.importe;
      if (m.esNoSocio) g.countNoSocios++;
    }
    return Array.from(mapa.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  });

  // Desglose por escuadra para vista dia
  escuadras = computed<GrupoEscuadra[]>(() => {
    const mapa = new Map<string, GrupoEscuadra>();
    let n = 1;
    for (const m of this.movimientos()) {
      if (!mapa.has(m.escuadraId))
        mapa.set(m.escuadraId, { escuadraId: m.escuadraId, numero: n++, movimientos: [], total: 0 });
      const g = mapa.get(m.escuadraId)!;
      g.movimientos.push(m);
      g.total += m.importe;
    }
    return Array.from(mapa.values());
  });

  esAdmin = computed(() => this.authService.currentUser?.rol === 'admin');

  // ── Init ──────────────────────────────────────────────────────────────────

  constructor() {
    void this.cargarDia(this.fechaDia());
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  pluralTiradores(n: number): string {
    return n === 1 ? '1 tirador' : `${n} tiradores`;
  }

  pluralNoSocios(n: number): string {
    return n === 1 ? '1 no socio' : `${n} no socios`;
  }

  // ── Navegación de vistas ──────────────────────────────────────────────────

  async setVista(v: VistaMode): Promise<void> {
    this.vista.set(v);
    if (v === 'dia')  await this.cargarDia(this.fechaDia());
    if (v === 'mes')  await this.cargarMes(this.mesFiltro());
    if (v === 'anio') await this.cargarAnio(this.anioFiltro());
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  async cargarDia(fecha: string): Promise<void> {
    this.fechaDia.set(fecha);
    this.cargando.set(true);
    try {
      this.movimientos.set(
        await firstValueFrom(this.escuadraService.getMovimientosCajaByFecha(fecha))
      );
    } finally { this.cargando.set(false); }
  }

  async cargarMes(mes: string): Promise<void> {
    this.mesFiltro.set(mes);
    this.cargando.set(true);
    try {
      this.movimientos.set(
        await firstValueFrom(this.escuadraService.getMovimientosCajaByMes(mes))
      );
    } finally { this.cargando.set(false); }
  }

  async cargarAnio(anio: number): Promise<void> {
    this.anioFiltro.set(anio);
    this.cargando.set(true);
    try {
      this.movimientos.set(
        await firstValueFrom(this.escuadraService.getMovimientosCajaByAno(anio))
      );
    } finally { this.cargando.set(false); }
  }

  irTarifas(): void { this.router.navigate(['/admin/caja/tarifas']); }
  goBack(): void    { this.router.navigate(['/admin/scores']); }
}
