# Contabilidad — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una vista de contabilidad completa (`/admin/contabilidad`) que combine todas las fuentes financieras del club (escuadras, torneos, cuotas, movimientos manuales) con navegación drill-down año → mes → día.

**Architecture:** Componente único con tabs (patrón de CajaComponent) + extensión de ContabilidadService con queries paralelas sobre 3 tablas. CRUD de movimientos manuales solo para admin. Migración RLS para restringir insert/delete a admin.

**Tech Stack:** Angular 19 (standalone, signals, computed), Supabase (PostgreSQL), Tailwind CSS 3, SCSS BEM

**Spec:** `docs/superpowers/specs/2026-04-14-contabilidad-design.md`

---

### Task 1: Modelo de datos — MovimientoContable

**Files:**
- Create: `src/app/core/models/movimiento-contable.model.ts`

- [ ] **Step 1: Crear el modelo**

```typescript
// src/app/core/models/movimiento-contable.model.ts

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
```

- [ ] **Step 2: Verificar que compila**

Run: `cd C:/Users/cristina.mf/Desktop/tap/appTap && npx tsc --noEmit --project tsconfig.json 2>&1 | head -5`
Expected: Sin errores relacionados con el nuevo archivo.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/movimiento-contable.model.ts
git commit -m "feat(contabilidad): add MovimientoContable model and related interfaces"
```

---

### Task 2: Extender ContabilidadService con queries por período

**Files:**
- Modify: `src/app/features/admin/contabilidad/contabilidad.service.ts`

- [ ] **Step 1: Añadir imports del nuevo modelo**

Al inicio de `contabilidad.service.ts`, añadir:

```typescript
import { MovimientoContable } from '../../../core/models/movimiento-contable.model';
```

- [ ] **Step 2: Añadir método privado base `getMovimientosContables`**

Añadir dentro de la clase `ContabilidadService`, después del método `getResumenAnual`:

```typescript
  // ── Contabilidad por período ─────────────────────────────────

  private async getMovimientosContables(desde: string, hasta: string): Promise<MovimientoContable[]> {
    const [resCaja, resManuales, resCuotas] = await Promise.all([
      // 1. Movimientos de caja (escuadras + torneos)
      supabase.from('movimientos_caja').select('id, torneo_id, nombre_tirador, importe, fecha')
        .gte('fecha', desde).lte('fecha', hasta),

      // 2. Movimientos manuales (gastos + ingresos)
      supabase.from('movimientos_manuales').select('id, tipo, concepto, importe, fecha')
        .gte('fecha', desde).lte('fecha', hasta),

      // 3. Cuotas pagadas con fecha_pago en el rango
      supabase.from('cuotas')
        .select('id, fecha_pago, profiles!inner(nombre, apellidos, tipo_cuota), temporadas!inner(importe_socio, importe_directivo, importe_honor)')
        .eq('pagada', true)
        .gte('fecha_pago', `${desde}T00:00:00`)
        .lte('fecha_pago', `${hasta}T23:59:59`),
    ]);

    const movimientos: MovimientoContable[] = [];

    // Mapear movimientos de caja
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

    // Mapear movimientos manuales
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

    // Mapear cuotas
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

    // Ordenar por fecha descendente
    movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return movimientos;
  }
```

- [ ] **Step 3: Añadir métodos públicos**

Añadir después del método privado:

```typescript
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
```

- [ ] **Step 4: Verificar que compila**

Run: `cd C:/Users/cristina.mf/Desktop/tap/appTap && npx tsc --noEmit --project tsconfig.json 2>&1 | head -10`
Expected: Sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/admin/contabilidad/contabilidad.service.ts
git commit -m "feat(contabilidad): add getContabilidadDia/Mes/Anio methods to service"
```

---

### Task 3: Crear ContabilidadComponent — lógica TypeScript

**Files:**
- Create: `src/app/features/admin/contabilidad/contabilidad.component.ts`

- [ ] **Step 1: Crear el componente**

```typescript
// src/app/features/admin/contabilidad/contabilidad.component.ts

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
      const mes = m.fecha.substring(0, 7); // 'YYYY-MM'
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
```

- [ ] **Step 2: Verificar que compila**

Run: `cd C:/Users/cristina.mf/Desktop/tap/appTap && npx tsc --noEmit --project tsconfig.json 2>&1 | head -10`
Expected: Puede fallar porque falta el template HTML. Eso se crea en la siguiente task.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/contabilidad/contabilidad.component.ts
git commit -m "feat(contabilidad): add ContabilidadComponent with signals and drill-down logic"
```

---

### Task 4: Crear ContabilidadComponent — template HTML

**Files:**
- Create: `src/app/features/admin/contabilidad/contabilidad.component.html`

- [ ] **Step 1: Crear el template**

```html
<!-- src/app/features/admin/contabilidad/contabilidad.component.html -->
<div class="conta-page">

  <!-- Header -->
  <div class="page-header">
    <button (click)="goBack()" class="conta-page__back-btn">
      <i class="bi bi-chevron-left"></i>
    </button>
    <h2 class="conta-page__title">Contabilidad</h2>
  </div>

  <!-- Tabs dia / mes / anio -->
  <div class="conta-tabs">
    <button [class.conta-tabs__tab--active]="vista() === 'dia'"  (click)="setVista('dia')">Día</button>
    <button [class.conta-tabs__tab--active]="vista() === 'mes'"  (click)="setVista('mes')">Mes</button>
    <button [class.conta-tabs__tab--active]="vista() === 'anio'" (click)="setVista('anio')">Año</button>
  </div>

  <!-- Filtro dia -->
  @if (vista() === 'dia') {
    <div class="conta-filtro">
      <label class="form-label">Fecha</label>
      <input type="date" class="form-input-surface"
        [value]="fechaDia()"
        (change)="cargarDia($any($event).target.value)" />
    </div>
  }

  <!-- Filtro mes -->
  @if (vista() === 'mes') {
    <div class="conta-filtro">
      <label class="form-label">Mes</label>
      <select class="form-input-surface"
        [value]="mesFiltro()"
        (change)="cargarMes($any($event).target.value)">
        @for (m of mesesDisponibles(); track m) {
          <option [value]="m">{{ labelMes(m) }}</option>
        }
      </select>
    </div>
  }

  <!-- Filtro anio -->
  @if (vista() === 'anio') {
    <div class="conta-filtro">
      <label class="form-label">Año</label>
      <select class="form-input-surface"
        [value]="anioFiltro()"
        (change)="cargarAnio(+$any($event).target.value)">
        @for (a of aniosDisponibles(); track a) {
          <option [value]="a">{{ a }}</option>
        }
      </select>
    </div>
  }

  <!-- Error -->
  @if (error()) {
    <p class="conta-error">{{ error() }}</p>
  }

  <!-- Tarjetas resumen -->
  @if (!cargando()) {
    <div class="conta-resumen">

      <div class="conta-resumen__balance card">
        <div class="conta-resumen__balance-label">
          <i class="bi bi-graph-up-arrow"></i>
          <span>Balance</span>
        </div>
        <p class="conta-resumen__balance-valor"
          [class.conta-resumen__balance-valor--positivo]="resumen().balance >= 0"
          [class.conta-resumen__balance-valor--negativo]="resumen().balance < 0">
          {{ resumen().balance >= 0 ? '+' : '' }}{{ resumen().balance | number:'1.2-2' }} &euro;
        </p>
      </div>

      <div class="conta-resumen__doble">
        <div class="card conta-resumen__mini">
          <p class="conta-resumen__mini-label">Ingresos</p>
          <p class="conta-resumen__mini-valor conta-resumen__mini-valor--ingreso">{{ resumen().ingresos | number:'1.2-2' }} &euro;</p>
        </div>
        <div class="card conta-resumen__mini">
          <p class="conta-resumen__mini-label">Gastos</p>
          <p class="conta-resumen__mini-valor conta-resumen__mini-valor--gasto">{{ resumen().gastos | number:'1.2-2' }} &euro;</p>
        </div>
      </div>

    </div>
  }

  <!-- Skeleton cargando -->
  @if (cargando()) {
    <div class="conta-skeleton">
      <div class="conta-skeleton__card"></div>
      <div class="conta-skeleton__doble">
        <div class="conta-skeleton__card conta-skeleton__card--sm"></div>
        <div class="conta-skeleton__card conta-skeleton__card--sm"></div>
      </div>
    </div>
  }

  <!-- Vacio -->
  @if (!cargando() && movimientos().length === 0) {
    <div class="conta-empty">
      <i class="bi bi-graph-up-arrow conta-empty__icon"></i>
      <p class="conta-empty__texto">Sin movimientos para este periodo</p>
    </div>
  }

  <!-- ══════ Vista AÑO: desglose por categoría ══════ -->
  @if (!cargando() && vista() === 'anio' && movimientos().length > 0) {
    <div class="card conta-desglose-cat">
      <p class="conta-section-label">Desglose por categoría</p>

      <div class="conta-desglose-cat__fila">
        <div class="conta-desglose-cat__left">
          <span class="conta-dot conta-dot--escuadra"></span>
          <span>Escuadras</span>
        </div>
        <span class="conta-desglose-cat__importe conta-desglose-cat__importe--ingreso">{{ desgloseCategoria().escuadras | number:'1.2-2' }} &euro;</span>
      </div>

      <div class="conta-desglose-cat__fila">
        <div class="conta-desglose-cat__left">
          <span class="conta-dot conta-dot--torneo"></span>
          <span>Torneos</span>
        </div>
        <span class="conta-desglose-cat__importe conta-desglose-cat__importe--ingreso">{{ desgloseCategoria().torneos | number:'1.2-2' }} &euro;</span>
      </div>

      <div class="conta-desglose-cat__fila">
        <div class="conta-desglose-cat__left">
          <span class="conta-dot conta-dot--cuota"></span>
          <span>Cuotas</span>
        </div>
        <span class="conta-desglose-cat__importe conta-desglose-cat__importe--ingreso">{{ desgloseCategoria().cuotas | number:'1.2-2' }} &euro;</span>
      </div>

      @if (desgloseCategoria().ingresosVarios > 0) {
        <div class="conta-desglose-cat__fila">
          <div class="conta-desglose-cat__left">
            <span class="conta-dot conta-dot--ingreso"></span>
            <span>Otros ingresos</span>
          </div>
          <span class="conta-desglose-cat__importe conta-desglose-cat__importe--ingreso">{{ desgloseCategoria().ingresosVarios | number:'1.2-2' }} &euro;</span>
        </div>
      }

      <div class="conta-desglose-cat__fila">
        <div class="conta-desglose-cat__left">
          <span class="conta-dot conta-dot--gasto"></span>
          <span>Gastos</span>
        </div>
        <span class="conta-desglose-cat__importe conta-desglose-cat__importe--gasto">-{{ desgloseCategoria().gastos | number:'1.2-2' }} &euro;</span>
      </div>
    </div>
  }

  <!-- ══════ Vista AÑO: desglose por mes ══════ -->
  @if (!cargando() && vista() === 'anio' && agrupadoPorMes().length > 0) {
    <p class="conta-section-label">Desglose por mes</p>

    @for (grupo of agrupadoPorMes(); track grupo.mes) {
      <div class="card conta-periodo-fila" (click)="drillDownMes(grupo.mes)">
        <div class="conta-periodo-fila__left">
          <p class="conta-periodo-fila__titulo">{{ grupo.label | titlecase }}</p>
          <p class="conta-periodo-fila__count">
            {{ grupo.countIngresos }} ingreso{{ grupo.countIngresos !== 1 ? 's' : '' }}
            @if (grupo.countGastos > 0) {
              &nbsp;&middot;&nbsp;{{ grupo.countGastos }} gasto{{ grupo.countGastos !== 1 ? 's' : '' }}
            }
          </p>
        </div>
        <div class="conta-periodo-fila__right">
          <p class="conta-periodo-fila__total"
            [class.conta-periodo-fila__total--positivo]="grupo.balance >= 0"
            [class.conta-periodo-fila__total--negativo]="grupo.balance < 0">
            {{ grupo.balance >= 0 ? '+' : '' }}{{ grupo.balance | number:'1.2-2' }} &euro;
          </p>
          <i class="bi bi-chevron-right conta-periodo-fila__arrow"></i>
        </div>
      </div>
    }
  }

  <!-- ══════ Vista MES: desglose por dia ══════ -->
  @if (!cargando() && vista() === 'mes' && agrupadoPorDia().length > 0) {
    <p class="conta-section-label">Desglose por día</p>

    @for (dia of agrupadoPorDia(); track dia.fecha) {
      <div class="card conta-periodo-fila" (click)="drillDownDia(dia.fecha)">
        <div class="conta-periodo-fila__left">
          <p class="conta-periodo-fila__titulo">
            {{ dia.fecha | date:'EEE d MMM':'':'es' | titlecase }}
          </p>
          <p class="conta-periodo-fila__count">
            {{ dia.countIngresos }} ingreso{{ dia.countIngresos !== 1 ? 's' : '' }}
            @if (dia.countGastos > 0) {
              &nbsp;&middot;&nbsp;{{ dia.countGastos }} gasto{{ dia.countGastos !== 1 ? 's' : '' }}
            }
          </p>
        </div>
        <div class="conta-periodo-fila__right">
          <p class="conta-periodo-fila__total"
            [class.conta-periodo-fila__total--positivo]="dia.balance >= 0"
            [class.conta-periodo-fila__total--negativo]="dia.balance < 0">
            {{ dia.balance >= 0 ? '+' : '' }}{{ dia.balance | number:'1.2-2' }} &euro;
          </p>
          <i class="bi bi-chevron-right conta-periodo-fila__arrow"></i>
        </div>
      </div>
    }
  }

  <!-- ══════ Vista DIA: movimientos individuales ══════ -->
  @if (!cargando() && vista() === 'dia' && movimientos().length > 0) {
    <p class="conta-section-label">Movimientos</p>

    <div class="card conta-movs">
      @for (mov of movimientos(); track mov.id) {
        <div class="conta-mov-fila">
          <div class="conta-mov-fila__info">
            <span class="conta-badge" [attr.data-cat]="mov.categoria">
              {{ labelCategoria(mov.categoria) }}
            </span>
            <span class="conta-mov-fila__concepto">{{ mov.concepto }}</span>
          </div>
          <div class="conta-mov-fila__right">
            <span class="conta-mov-fila__importe"
              [class.conta-mov-fila__importe--ingreso]="!mov.esGasto"
              [class.conta-mov-fila__importe--gasto]="mov.esGasto">
              {{ mov.esGasto ? '-' : '+' }}{{ mov.importe | number:'1.2-2' }} &euro;
            </span>
            @if (esAdmin() && esMovimientoManual(mov)) {
              <button (click)="eliminarMovimiento(mov); $event.stopPropagation()" class="conta-mov-fila__btn-del">
                <i class="bi bi-trash3"></i>
              </button>
            }
          </div>
        </div>
      }
    </div>
  }

  <!-- Botones registrar (solo admin) -->
  @if (!cargando() && esAdmin()) {
    <!-- Formulario nuevo movimiento -->
    @if (mostrarFormMovimiento()) {
      <div class="card conta-form-mov">
        <p class="conta-form-mov__titulo">
          {{ tipoMovimiento() === 'gasto' ? 'Nuevo gasto' : 'Nuevo ingreso' }}
        </p>
        <div class="conta-form-mov__campo">
          <label class="form-label">Concepto</label>
          <input
            [(ngModel)]="nuevoConcepto"
            placeholder="Ej: Material de tiro, Patrocinio..."
            class="form-input-surface" />
        </div>
        <div class="conta-form-mov__row">
          <div class="conta-form-mov__campo conta-form-mov__campo--flex">
            <label class="form-label">Importe (&euro;)</label>
            <input
              type="number"
              [(ngModel)]="nuevoImporte"
              min="0.01"
              step="0.50"
              placeholder="0,00"
              class="form-input-surface" />
          </div>
          <div class="conta-form-mov__campo conta-form-mov__campo--flex">
            <label class="form-label">Fecha</label>
            <input
              type="date"
              [(ngModel)]="nuevoFecha"
              class="form-input-surface" />
          </div>
        </div>
        <div class="conta-form-mov__acciones">
          <button (click)="cancelarFormMovimiento()" [disabled]="guardando()" class="conta-form-mov__btn-cancel">
            Cancelar
          </button>
          <button
            (click)="guardarMovimiento()"
            [disabled]="guardando() || !nuevoConcepto.trim() || !nuevoImporte || nuevoImporte <= 0"
            class="btn-primary conta-form-mov__btn-save">
            {{ guardando() ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    }

    <div class="conta-admin-acciones">
      <button (click)="abrirFormMovimiento('ingreso')" class="btn-primary conta-admin-acciones__btn">
        <i class="bi bi-plus-circle"></i> Ingreso
      </button>
      <button (click)="abrirFormMovimiento('gasto')" class="conta-admin-acciones__btn conta-admin-acciones__btn--gasto">
        <i class="bi bi-dash-circle"></i> Gasto
      </button>
    </div>
  }

</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/admin/contabilidad/contabilidad.component.html
git commit -m "feat(contabilidad): add ContabilidadComponent template with all 3 views"
```

---

### Task 5: Crear ContabilidadComponent — estilos SCSS

**Files:**
- Create: `src/app/features/admin/contabilidad/contabilidad.component.scss`

- [ ] **Step 1: Crear los estilos**

```scss
// src/app/features/admin/contabilidad/contabilidad.component.scss

.conta-page {
  @apply p-3 flex flex-col gap-3;

  &__back-btn {
    @apply text-neutral-400 text-[15px];
  }

  &__title {
    @apply text-[18px] font-bold text-secondary flex-1;
  }
}

// ── Tabs ──────────────────────────────────────────────────────

.conta-tabs {
  @apply flex bg-neutral-100 rounded-card p-1 gap-1;

  button {
    @apply flex-1 py-1.5 rounded-[8px] text-sm font-semibold
           text-neutral-400 transition-all duration-fast cursor-pointer
           border-0 bg-transparent;

    &.conta-tabs__tab--active {
      @apply bg-white text-secondary shadow-card;
    }
  }
}

// ── Filtro ────────────────────────────────────────────────────

.conta-filtro {
  @apply flex flex-col gap-1;
}

// ── Error ─────────────────────────────────────────────────────

.conta-error {
  @apply text-sm text-error font-medium bg-error/10 rounded-card px-3 py-2;
}

// ── Resumen ───────────────────────────────────────────────────

.conta-resumen {
  @apply flex flex-col gap-2;

  &__balance {
    @apply flex items-center justify-between py-3 px-4;
  }

  &__balance-label {
    @apply flex items-center gap-2 text-sm font-semibold text-neutral-400;
    i { @apply text-[16px]; }
  }

  &__balance-valor {
    @apply text-xl font-bold;
    &--positivo { @apply text-success; }
    &--negativo { @apply text-error; }
  }

  &__doble {
    @apply grid grid-cols-2 gap-2;
  }

  &__mini {
    @apply flex flex-col gap-0.5 py-3 px-3;
  }

  &__mini-label {
    @apply text-xs font-semibold text-neutral-400 uppercase tracking-wide;
  }

  &__mini-valor {
    @apply text-lg font-bold mt-1;
    &--ingreso { @apply text-success; }
    &--gasto   { @apply text-error; }
  }
}

// ── Skeleton ──────────────────────────────────────────────────

.conta-skeleton {
  @apply flex flex-col gap-2;

  &__card {
    @apply h-14 rounded-card bg-neutral-100 animate-pulse;
    &--sm { @apply h-20; }
  }

  &__doble {
    @apply grid grid-cols-2 gap-2;
  }
}

// ── Empty ─────────────────────────────────────────────────────

.conta-empty {
  @apply flex flex-col items-center justify-center py-10 text-center;

  &__icon  { @apply text-[40px] text-neutral-200 mb-2; }
  &__texto { @apply text-sm font-bold text-neutral-300 uppercase tracking-wider; }
}

// ── Section label ─────────────────────────────────────────────

.conta-section-label {
  @apply text-xs font-semibold text-neutral-400 uppercase tracking-[1.5px] mt-1;
}

// ── Desglose por categoría (vista año) ────────────────────────

.conta-desglose-cat {
  @apply flex flex-col gap-0 py-3 px-4;

  .conta-section-label { @apply mb-2; }

  &__fila {
    @apply flex items-center justify-between py-1.5
           border-b border-neutral-100 last:border-b-0;
  }

  &__left {
    @apply flex items-center gap-2 text-sm text-secondary;
  }

  &__importe {
    @apply text-sm font-bold;
    &--ingreso { @apply text-success; }
    &--gasto   { @apply text-error; }
  }
}

.conta-dot {
  @apply w-2 h-2 rounded-full inline-block flex-shrink-0;
  &--escuadra { @apply bg-blue-200; }
  &--torneo   { @apply bg-amber-200; }
  &--cuota    { @apply bg-emerald-200; }
  &--ingreso  { @apply bg-indigo-200; }
  &--gasto    { @apply bg-red-200; }
}

// ── Fila período (mes/año → drill-down) ──────────────────────

.conta-periodo-fila {
  @apply flex items-center justify-between py-3 px-4 mb-2 cursor-pointer
         active:bg-neutral-50 transition-colors;

  &__left   { @apply flex flex-col gap-0.5; }
  &__titulo { @apply text-sm font-bold text-secondary; }
  &__count  { @apply text-xs text-neutral-400 font-medium; }

  &__right  { @apply flex items-center gap-2 flex-shrink-0; }
  &__total  {
    @apply text-base font-bold;
    &--positivo { @apply text-success; }
    &--negativo { @apply text-error; }
  }
  &__arrow  { @apply text-neutral-300 text-xs; }
}

// ── Lista movimientos (vista día) ─────────────────────────────

.conta-movs {
  @apply p-0 overflow-hidden;
}

.conta-mov-fila {
  @apply flex items-center justify-between px-4 py-2.5
         border-b border-neutral-100 last:border-b-0;

  &__info    { @apply flex items-center gap-2 min-w-0 flex-1; }
  &__concepto { @apply text-sm font-medium text-secondary truncate; }

  &__right   { @apply flex items-center gap-2 flex-shrink-0; }
  &__importe {
    @apply text-sm font-bold;
    &--ingreso { @apply text-success; }
    &--gasto   { @apply text-error; }
  }
  &__btn-del {
    @apply text-neutral-300 text-xs cursor-pointer hover:text-error transition-colors;
  }
}

// ── Badges de categoría ───────────────────────────────────────

.conta-badge {
  @apply inline-flex items-center px-1.5 py-0.5 rounded-badge
         text-[9px] font-bold uppercase tracking-wide flex-shrink-0;

  &[data-cat="escuadra"]       { @apply bg-blue-100 text-blue-800 border border-blue-200; }
  &[data-cat="torneo"]         { @apply bg-amber-100 text-amber-800 border border-amber-200; }
  &[data-cat="cuota"]          { @apply bg-emerald-100 text-emerald-800 border border-emerald-200; }
  &[data-cat="ingreso_manual"] { @apply bg-indigo-100 text-indigo-800 border border-indigo-200; }
  &[data-cat="gasto_manual"]   { @apply bg-red-100 text-red-800 border border-red-200; }
}

// ── Formulario movimiento ─────────────────────────────────────

.conta-form-mov {
  @apply flex flex-col gap-3 p-4;

  &__titulo {
    @apply text-sm font-bold text-secondary;
  }

  &__campo {
    @apply flex flex-col gap-1;
  }

  &__row {
    @apply flex gap-3;
  }

  &__campo--flex {
    @apply flex-1;
  }

  &__acciones {
    @apply flex justify-end gap-2 mt-1;
  }

  &__btn-cancel {
    @apply px-4 py-2 text-sm font-semibold text-neutral-400
           rounded-card border border-neutral-200 bg-white
           cursor-pointer active:bg-neutral-50 transition-colors;
  }

  &__btn-save {
    @apply px-4 py-2 text-sm;
  }
}

// ── Botones admin ─────────────────────────────────────────────

.conta-admin-acciones {
  @apply flex gap-2 mt-1;

  &__btn {
    @apply flex-1 flex items-center justify-center gap-1.5
           py-2.5 rounded-card text-sm font-bold cursor-pointer
           transition-colors;

    &:first-child {
      // btn-primary ya le da estilo
    }

    &--gasto {
      @apply bg-white border border-neutral-200 text-error
             active:bg-neutral-50;
    }
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd C:/Users/cristina.mf/Desktop/tap/appTap && npx ng build 2>&1 | tail -5`
Expected: Build exitoso (o warnings menores no bloqueantes).

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/contabilidad/contabilidad.component.scss
git commit -m "feat(contabilidad): add ContabilidadComponent styles"
```

---

### Task 6: Registrar ruta en admin.routes.ts

**Files:**
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Añadir la ruta de contabilidad**

En `admin.routes.ts`, añadir después del bloque de rutas de Caja (después de la ruta `caja/tarifas`, antes de `// ── Entrenamientos`):

```typescript
  // ── Contabilidad ────────────────────────────────────────────────────────────
  {
    path: 'contabilidad',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./contabilidad/contabilidad.component').then(m => m.ContabilidadComponent),
  },
```

- [ ] **Step 2: Verificar que compila**

Run: `cd C:/Users/cristina.mf/Desktop/tap/appTap && npx ng build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/admin.routes.ts
git commit -m "feat(contabilidad): add /admin/contabilidad route"
```

---

### Task 7: Actualizar perfil — simplificar admin + añadir enlace contabilidad

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts`
- Modify: `src/app/features/perfil/perfil.component.html`

- [ ] **Step 1: Añadir método `irContabilidad()` en perfil.component.ts**

Dentro de la sección `// ── Navegación admin`, añadir:

```typescript
  irContabilidad(): void { this.router.navigate(['/admin/contabilidad']); }
```

- [ ] **Step 2: Eliminar lógica CRUD de movimientos manuales de perfil.component.ts**

Eliminar los siguientes campos y métodos (ya no se necesitan porque se movieron a ContabilidadComponent):

- Eliminar `import { MovimientoManual } from ...` (línea 12)
- Eliminar campo: `movimientosManuales = signal<MovimientoManual[]>([]);` (línea 52)
- Eliminar campo: `mostrarFormMovimiento = signal(false);` (línea 57)
- Eliminar campo: `tipoMovimiento = signal<'gasto' | 'ingreso'>('gasto');` (línea 58)
- Eliminar campo: `nuevoConcepto = '';` (línea 59)
- Eliminar campo: `nuevoImporte: number | null = null;` (línea 60)
- Eliminar campo: `nuevoFecha = ...` (línea 61)
- Eliminar campo: `guardando = signal(false);` (línea 62)
- En `cargarDatosAdmin()`, eliminar la carga de `movimientosManuales` — cambiar `Promise.all` por solo cargar el resumen:

Cambiar:

```typescript
  async cargarDatosAdmin(): Promise<void> {
    this.cargandoResumen.set(true);
    try {
      const temporada = await firstValueFrom(this.cuotaService.getTemporadaActiva());
      const [resumen, manuales] = await Promise.all([
        this.contabilidadService.getResumenAnual(this.anioAdmin, temporada?.id ?? null),
        firstValueFrom(this.contabilidadService.getMovimientosManuales(this.anioAdmin)),
      ]);
      this.resumen.set(resumen);
      this.movimientosManuales.set(manuales);
    } catch (e: any) {
      this.errorAdmin.set(e.message ?? 'Error cargando datos');
    } finally {
      this.cargandoResumen.set(false);
    }
  }
```

Por:

```typescript
  async cargarDatosAdmin(): Promise<void> {
    this.cargandoResumen.set(true);
    try {
      const temporada = await firstValueFrom(this.cuotaService.getTemporadaActiva());
      const resumen = await this.contabilidadService.getResumenAnual(
        this.anioAdmin,
        temporada?.id ?? null
      );
      this.resumen.set(resumen);
    } catch (e: any) {
      this.errorAdmin.set(e.message ?? 'Error cargando datos');
    } finally {
      this.cargandoResumen.set(false);
    }
  }
```

- Eliminar métodos: `abrirFormMovimiento()`, `cancelarFormMovimiento()`, `guardarMovimiento()`, `eliminarMovimientoManual()`

- [ ] **Step 3: Actualizar perfil.component.html — tab Administración**

Reemplazar todo el bloque desde `<!-- Botones registrar -->` hasta antes de `} @else {` (el cierre del `@if (tabAdmin() === 'admin')`) — es decir, eliminar los botones, formulario y lista de movimientos manuales. En su lugar, añadir un enlace a contabilidad:

Reemplazar el bloque de líneas 153-241 (desde `<!-- Botones registrar -->` hasta el cierre `}` antes de `} @else {`) por:

```html
      <!-- Enlace a contabilidad -->
      <button (click)="irContabilidad()" class="conta-link card">
        <div class="conta-link__left">
          <i class="bi bi-graph-up-arrow"></i>
          <span>Ver contabilidad completa</span>
        </div>
        <i class="bi bi-chevron-right conta-link__arrow"></i>
      </button>
```

- [ ] **Step 4: Actualizar perfil.component.html — tab Estadísticas**

Añadir card de Contabilidad después del card de Caja (después del cierre `</button>` de Caja, antes del card de Entrenamientos):

```html
        <button (click)="irContabilidad()" class="perfil-admin__link card">
          <i class="bi bi-graph-up-arrow perfil-admin__link-icon"></i>
          <div>
            <p class="perfil-admin__link-titulo">Contabilidad</p>
            <p class="perfil-admin__link-sub">Balance financiero del club</p>
          </div>
          <i class="bi bi-chevron-right perfil-admin__link-arrow"></i>
        </button>
```

- [ ] **Step 5: Añadir estilos del enlace a contabilidad en perfil.component.scss**

Añadir al final de `perfil.component.scss`:

```scss
// ── Enlace contabilidad ───────────────────────────────────────
.conta-link {
  @apply flex items-center justify-between py-3 px-4 cursor-pointer
         active:bg-neutral-50 transition-colors mt-2;

  &__left {
    @apply flex items-center gap-2 text-sm font-semibold text-secondary;
    i { @apply text-[16px] text-primary; }
  }

  &__arrow {
    @apply text-neutral-300 text-xs;
  }
}
```

- [ ] **Step 6: Verificar que compila**

Run: `cd C:/Users/cristina.mf/Desktop/tap/appTap && npx ng build 2>&1 | tail -10`
Expected: Build exitoso.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/perfil/perfil.component.ts src/app/features/perfil/perfil.component.html src/app/features/perfil/perfil.component.scss
git commit -m "refactor(perfil): move CRUD to contabilidad, add navigation link"
```

---

### Task 8: Migración SQL — restringir movimientos_manuales a admin

**Files:**
- Create: `supabase/migrations/026_movimientos_manuales_solo_admin.sql`

- [ ] **Step 1: Crear la migración**

```sql
-- 026_movimientos_manuales_solo_admin.sql
-- Restringir insert/delete de movimientos_manuales a solo admin.
-- SELECT se mantiene para admin + moderador.

DROP POLICY IF EXISTS "movimientos_manuales_insert" ON public.movimientos_manuales;
DROP POLICY IF EXISTS "movimientos_manuales_delete" ON public.movimientos_manuales;

CREATE POLICY "movimientos_manuales_insert_admin"
  ON public.movimientos_manuales FOR INSERT
  WITH CHECK (public.get_my_rol() = 'admin');

CREATE POLICY "movimientos_manuales_delete_admin"
  ON public.movimientos_manuales FOR DELETE
  USING (public.get_my_rol() = 'admin');
```

- [ ] **Step 2: Aplicar en Supabase**

Ejecutar el SQL en el SQL Editor de Supabase Dashboard (proyecto de producción).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/026_movimientos_manuales_solo_admin.sql
git commit -m "fix(rls): restrict movimientos_manuales insert/delete to admin only"
```

---

### Task 9: Test manual — verificar todas las vistas

**Files:** Ninguno (test manual)

- [ ] **Step 1: Iniciar dev server**

Run: `cd C:/Users/cristina.mf/Desktop/tap/appTap && npm start`
Abrir: `http://localhost:4200`

- [ ] **Step 2: Verificar ruta y acceso**

1. Login como admin
2. Ir a Perfil → tab Administración → verificar que aparece "Ver contabilidad completa" en lugar del formulario de gastos
3. Ir a Perfil → tab Estadísticas → verificar que aparece card "Contabilidad" junto a "Caja"
4. Click en "Contabilidad" → verificar que navega a `/admin/contabilidad`

- [ ] **Step 3: Verificar vista Día**

1. Debería mostrar movimientos del día actual (puede estar vacío)
2. Cambiar fecha a un día con movimientos conocidos
3. Verificar badges de categoría con colores correctos
4. Verificar balance = ingresos - gastos
5. Verificar botones +Ingreso / -Gasto visibles

- [ ] **Step 4: Verificar CRUD**

1. Click "+Ingreso" → formulario aparece
2. Rellenar concepto, importe, fecha → Guardar
3. Verificar que aparece en la lista con badge "INGRESO"
4. Click icono eliminar → confirm → verificar que desaparece
5. Repetir con "Gasto"

- [ ] **Step 5: Verificar vista Mes**

1. Click tab "Mes"
2. Verificar desglose por día
3. Click en un día → verificar drill-down a vista Día con esa fecha
4. Click botón atrás → verificar que vuelve a vista Mes

- [ ] **Step 6: Verificar vista Año**

1. Click tab "Año"
2. Verificar desglose por categoría (escuadras, torneos, cuotas, gastos)
3. Verificar desglose por mes
4. Click en un mes → verificar drill-down a vista Mes
5. Click en un día → verificar drill-down a vista Día
6. Click atrás → Mes → atrás → Año

- [ ] **Step 7: Verificar permisos moderador**

1. Login como moderador
2. Navegar a `/admin/contabilidad`
3. Verificar que puede ver datos pero NO ve botones +Ingreso / -Gasto ni iconos eliminar

- [ ] **Step 8: Commit final**

```bash
git add -A
git commit -m "feat(contabilidad): complete accounting view with drill-down and CRUD"
```
