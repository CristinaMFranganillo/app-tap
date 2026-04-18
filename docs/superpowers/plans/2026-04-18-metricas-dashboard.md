# Dashboard de Métricas del Tirador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el componente `MetricasComponent` en `/metricas` que reemplaza `/perfil` para los socios, mostrando KPIs, evolución temporal, heatmaps de esquemas y platos, análisis por puesto y métricas de racha/consistencia.

**Architecture:** El componente nuevo reutiliza lógica ya existente en `perfil.component.ts` (misEntrenamientos, heatmapEsquemas, svgEvolucion, fallosFiltrados) y añade los bloques nuevos (análisis por puesto, racha/consistencia). Todo está en `metricas.component.ts` — no se crea un servicio separado porque la lógica es presentacional y los métodos de datos ya existen en `EntrenamientoService`. El `PerfilComponent` se elimina y sus rutas se actualizan.

**Tech Stack:** Angular 19 standalone, Signals + RxJS, Tailwind CSS 3 + SCSS, Bootstrap Icons, SVG inline para gráficos.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `src/app/features/metricas/metricas.component.ts` |
| Crear | `src/app/features/metricas/metricas.component.html` |
| Crear | `src/app/features/metricas/metricas.component.scss` |
| Modificar | `src/app/app.routes.ts` — añadir `/metricas`, eliminar `/perfil` |
| Modificar | `src/app/shared/components/bottom-nav/bottom-nav.component.ts` — `/perfil` → `/metricas` en SOCIO_NAV |
| Eliminar | `src/app/features/perfil/` (todos los archivos) |

---

## Task 1: Crear el componente `MetricasComponent` (lógica TypeScript)

**Files:**
- Create: `src/app/features/metricas/metricas.component.ts`

- [ ] **Step 1: Crear el archivo TypeScript del componente**

```typescript
// src/app/features/metricas/metricas.component.ts
import { Component, inject, computed, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, EMPTY, forkJoin, of, Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { ResultadoEntrenamientoConFecha } from '../../core/models/entrenamiento.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-metricas',
  standalone: true,
  imports: [EmptyStateComponent, DecimalPipe],
  templateUrl: './metricas.component.html',
  styleUrl: './metricas.component.scss',
})
export class MetricasComponent {
  private authService = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  // ── Filtros ─────────────────────────────────────────────────────
  readonly anioActual = new Date().getFullYear();
  anioSeleccionado = signal(this.anioActual);
  aniosComparativos = signal<number[]>([]);
  esquemaSeleccionado = signal<number | null>(null);

  readonly aniosDisponibles = Array.from({ length: 5 }, (_, i) => this.anioActual - i);
  readonly mesesAbrev = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // ── Datos crudos (reactivos al año) ─────────────────────────────
  misEntrenamientos = toSignal(
    combineLatest([
      this.authService.currentUser$,
      toObservable(this.anioSeleccionado),
    ]).pipe(
      switchMap(([u, year]) =>
        u?.id ? this.entrenamientoService.getByUser(u.id, year) : EMPTY
      )
    ),
    { initialValue: [] as ResultadoEntrenamientoConFecha[] }
  );

  entrenamientosComparativos = toSignal(
    combineLatest([
      this.authService.currentUser$,
      toObservable(this.aniosComparativos),
    ]).pipe(
      switchMap(([u, years]) => {
        if (!u?.id || years.length === 0) return of(new Map<number, ResultadoEntrenamientoConFecha[]>());
        const obs: Record<string, Observable<ResultadoEntrenamientoConFecha[]>> = {};
        for (const y of years) obs[String(y)] = this.entrenamientoService.getByUser(u.id, y);
        return forkJoin(obs).pipe(
          map(result => {
            const m = new Map<number, ResultadoEntrenamientoConFecha[]>();
            for (const [k, v] of Object.entries(result)) m.set(Number(k), v);
            return m;
          })
        );
      })
    ),
    { initialValue: new Map<number, ResultadoEntrenamientoConFecha[]>() }
  );

  rankingAnual = toSignal(
    toObservable(this.anioSeleccionado).pipe(
      switchMap(year => this.entrenamientoService.getRankingAnual(year))
    ),
    { initialValue: [] as { userId: string; mediaPlatos: number; totalEntrenamientos: number; mejorResultado: number }[] }
  );

  misFallosAnuales = toSignal(
    combineLatest([
      this.authService.currentUser$,
      toObservable(this.anioSeleccionado),
    ]).pipe(
      switchMap(([u, year]) =>
        u?.id ? this.entrenamientoService.getFallosByUserAndYear(u.id, year) : of([])
      )
    ),
    { initialValue: [] as { numeroPlato: number; esquema: number | null }[] }
  );

  // ── Computed: filtros aplicados ──────────────────────────────────
  entrenamientosFiltrados = computed(() => {
    const esq = this.esquemaSeleccionado();
    const list = this.misEntrenamientos();
    return esq === null ? list : list.filter(r => r.esquema === esq);
  });

  fallosFiltrados = computed(() => {
    const esq = this.esquemaSeleccionado();
    const list = this.misFallosAnuales();
    return esq === null ? list : list.filter(f => f.esquema === esq);
  });

  // ── KPIs globales ────────────────────────────────────────────────
  totalSesiones = computed(() => this.misEntrenamientos().length);

  mediaAnual = computed(() => {
    const list = this.misEntrenamientos();
    if (list.length === 0) return 0;
    return Math.round((list.reduce((a, r) => a + r.platosRotos, 0) / list.length) * 10) / 10;
  });

  mejorResultado = computed(() =>
    this.misEntrenamientos().reduce((max, r) => Math.max(max, r.platosRotos), 0)
  );

  fechaMejorResultado = computed(() => {
    const list = this.misEntrenamientos();
    const mejor = this.mejorResultado();
    if (mejor === 0) return null;
    const entry = list.find(r => r.platosRotos === mejor);
    return entry?.fecha ?? null;
  });

  posicionClub = computed(() => {
    const ranking = this.rankingAnual();
    const userId = this.user()?.id;
    if (!userId || ranking.length === 0) return null;
    const pos = ranking.findIndex(r => r.userId === userId);
    return pos === -1 ? null : { posicion: pos + 1, total: ranking.length };
  });

  mediaClub = computed(() => {
    const ranking = this.rankingAnual();
    if (ranking.length === 0) return 0;
    return Math.round((ranking.reduce((a, r) => a + r.mediaPlatos, 0) / ranking.length) * 10) / 10;
  });

  // ── Heatmap esquemas (1–10) ──────────────────────────────────────
  heatmapEsquemas = computed(() => {
    const list = this.misEntrenamientos();
    const buckets = new Map<number, number[]>();
    for (let e = 1; e <= 10; e++) buckets.set(e, []);
    for (const r of list) {
      if (r.esquema && r.esquema >= 1 && r.esquema <= 10) {
        buckets.get(r.esquema)!.push(r.platosRotos);
      }
    }
    return Array.from(buckets.entries()).map(([esquema, arr]) => ({
      esquema,
      sesiones: arr.length,
      mediaPlatos: arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
    }));
  });

  claseCeldaEsquema(celda: { esquema: number; sesiones: number; mediaPlatos: number | null }): string {
    const m = celda.mediaPlatos;
    const activo = this.esquemaSeleccionado() === celda.esquema;
    const base = 'metricas-esquema__celda';
    if (m === null) return `${base} ${base}--vacia${activo ? ` ${base}--activa` : ''}`;
    let nivel = m < 15 ? `${base}--bajo` : m <= 20 ? `${base}--medio` : `${base}--alto`;
    return `${base} ${nivel}${activo ? ` ${base}--activa` : ''}`;
  }

  seleccionarEsquema(esquema: number): void {
    this.esquemaSeleccionado.set(this.esquemaSeleccionado() === esquema ? null : esquema);
  }

  // ── Heatmap platos (1–25) ────────────────────────────────────────
  heatmapFallos = computed(() => {
    const fallos = this.fallosFiltrados();
    const counts = new Map<number, number>();
    for (const f of fallos) counts.set(f.numeroPlato, (counts.get(f.numeroPlato) ?? 0) + 1);
    const maxVeces = counts.size > 0 ? Math.max(...counts.values()) : 0;
    return Array.from({ length: 25 }, (_, i) => ({
      plato: i + 1,
      veces: counts.get(i + 1) ?? 0,
      maxVeces,
    }));
  });

  claseCeldaFallo(celda: { plato: number; veces: number; maxVeces: number }): string {
    const base = 'metricas-fallos__celda';
    if (celda.veces === 0) return `${base} ${base}--cero`;
    const ratio = celda.veces / celda.maxVeces;
    if (ratio > 0.66) return `${base} ${base}--alto`;
    if (ratio > 0.33) return `${base} ${base}--medio`;
    return `${base} ${base}--bajo`;
  }

  platosMasFallados = computed(() =>
    this.heatmapFallos()
      .filter(c => c.veces > 0)
      .sort((a, b) => b.veces - a.veces)
      .slice(0, 3)
      .map(c => c.plato)
  );

  puestoMasDebil = computed(() => {
    const analisis = this.analisisPuestos();
    const conDatos = analisis.filter(p => p.fallos > 0);
    if (conDatos.length === 0) return null;
    return conDatos.reduce((max, p) => p.fallos > max.fallos ? p : max).puesto;
  });

  // ── Análisis por puesto (1–6) ────────────────────────────────────
  analisisPuestos = computed(() => {
    const resultados = this.entrenamientosFiltrados();
    const fallos = this.fallosFiltrados();

    // Platos rotos por puesto (de resultados_entrenamiento.puesto)
    const platosMap = new Map<number, number[]>();
    for (let p = 1; p <= 6; p++) platosMap.set(p, []);
    for (const r of resultados) {
      if (r.puesto >= 1 && r.puesto <= 6) platosMap.get(r.puesto)!.push(r.platosRotos);
    }

    // Fallos por puesto (derivado de numero_plato: ceil(plato/5))
    const fallosMap = new Map<number, number>();
    for (let p = 1; p <= 6; p++) fallosMap.set(p, 0);
    for (const f of fallos) {
      const puesto = Math.ceil(f.numeroPlato / 5);
      if (puesto >= 1 && puesto <= 6) fallosMap.set(puesto, (fallosMap.get(puesto) ?? 0) + 1);
    }

    return Array.from({ length: 6 }, (_, i) => {
      const puesto = i + 1;
      const arr = platosMap.get(puesto)!;
      const media = arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
      return { puesto, media, fallos: fallosMap.get(puesto) ?? 0, sesiones: arr.length };
    });
  });

  mejorPuesto = computed(() => {
    const con = this.analisisPuestos().filter(p => p.media !== null);
    if (con.length === 0) return null;
    return con.reduce((max, p) => p.media! > max.media! ? p : max).puesto;
  });

  peorPuesto = computed(() => {
    const con = this.analisisPuestos().filter(p => p.media !== null);
    if (con.length < 2) return null;
    return con.reduce((min, p) => p.media! < min.media! ? p : min).puesto;
  });

  maxMediaPuesto = computed(() => {
    const con = this.analisisPuestos().filter(p => p.media !== null);
    if (con.length === 0) return 25;
    return Math.max(...con.map(p => p.media!));
  });

  // ── Evolución mensual (SVG) ──────────────────────────────────────
  private calcularMediasMensuales(list: ResultadoEntrenamientoConFecha[]): (number | null)[] {
    const buckets = Array.from({ length: 12 }, () => [] as number[]);
    for (const r of list) {
      const mes = new Date(r.fecha).getMonth();
      buckets[mes].push(r.platosRotos);
    }
    return buckets.map(arr =>
      arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
    );
  }

  evolucionMensual = computed(() => {
    const esq = this.esquemaSeleccionado();
    const filtrar = (list: ResultadoEntrenamientoConFecha[]) =>
      esq === null ? list : list.filter(r => r.esquema === esq);
    const result = new Map<number, (number | null)[]>();
    result.set(this.anioSeleccionado(), this.calcularMediasMensuales(filtrar(this.misEntrenamientos())));
    for (const [year, list] of this.entrenamientosComparativos().entries()) {
      result.set(year, this.calcularMediasMensuales(filtrar(list)));
    }
    return result;
  });

  evolucionClubMensual = computed((): (number | null)[] => {
    // No tenemos datos mensuales del club por ranking, devolvemos la media plana
    const media = this.mediaClub();
    if (media === 0) return Array(12).fill(null);
    return Array(12).fill(media);
  });

  svgLineas = computed(() => {
    const data = this.evolucionMensual();
    const W = 300, H = 120, PAD_X = 30, PAD_Y = 8;
    const colores = [
      { anio: this.anioSeleccionado(), color: '#FFAE00', punteado: false },
      ...this.aniosComparativos().map((a) => ({ anio: a, color: '#60A5FA', punteado: false })),
    ];
    return colores.map(({ anio, color, punteado }) => {
      const medias = data.get(anio);
      if (!medias) return null;
      const dots: { x: number; y: number; media: number; mes: number }[] = [];
      for (let m = 0; m < 12; m++) {
        if (medias[m] === null) continue;
        const x = PAD_X + (m / 11) * (W - PAD_X * 2);
        const y = H - PAD_Y - ((medias[m]! / 25) * (H - PAD_Y * 2));
        dots.push({ x, y, media: medias[m]!, mes: m });
      }
      return { anio, color, punteado, points: dots.map(d => `${d.x},${d.y}`).join(' '), dots };
    }).filter(Boolean);
  });

  svgLineaClub = computed(() => {
    const W = 300, H = 120, PAD_X = 30, PAD_Y = 8;
    const medias = this.evolucionClubMensual();
    const dots = medias
      .map((m, i) => m === null ? null : {
        x: PAD_X + (i / 11) * (W - PAD_X * 2),
        y: H - PAD_Y - ((m / 25) * (H - PAD_Y * 2)),
      })
      .filter(Boolean) as { x: number; y: number }[];
    return dots.map(d => `${d.x},${d.y}`).join(' ');
  });

  // ── Racha y consistencia ─────────────────────────────────────────
  rachaActual = computed(() => {
    const list = [...this.misEntrenamientos()].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const media = this.mediaAnual();
    if (list.length === 0 || media === 0) return 0;
    let racha = 0;
    for (const r of list) {
      if (r.platosRotos > media) racha++;
      else break;
    }
    return racha;
  });

  mejorRacha = computed(() => {
    const list = [...this.misEntrenamientos()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const media = this.mediaAnual();
    if (list.length === 0 || media === 0) return 0;
    let mejor = 0, actual = 0;
    for (const r of list) {
      if (r.platosRotos > media) { actual++; mejor = Math.max(mejor, actual); }
      else actual = 0;
    }
    return mejor;
  });

  consistencia = computed(() => {
    const list = this.misEntrenamientos();
    if (list.length < 2) return null;
    const media = this.mediaAnual();
    const varianza = list.reduce((acc, r) => acc + Math.pow(r.platosRotos - media, 2), 0) / list.length;
    const std = Math.sqrt(varianza);
    const label = std < 2 ? 'Muy consistente' : std < 4 ? 'Regular' : 'Variable';
    return { std: Math.round(std * 10) / 10, label };
  });

  tendenciaReciente = computed(() =>
    [...this.misEntrenamientos()]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5)
      .reverse()
      .map(r => ({ fecha: r.fecha, platos: r.platosRotos }))
  );

  svgSparkline = computed(() => {
    const datos = this.tendenciaReciente();
    if (datos.length < 2) return '';
    const W = 80, H = 30;
    const valores = datos.map(d => d.platos);
    const minV = Math.min(...valores);
    const maxV = Math.max(...valores);
    const rango = maxV - minV || 1;
    const points = datos.map((d, i) => {
      const x = (i / (datos.length - 1)) * W;
      const y = H - ((d.platos - minV) / rango) * H;
      return `${x},${y}`;
    }).join(' ');
    return points;
  });

  // ── Controles de año ─────────────────────────────────────────────
  anioAnterior(): void {
    const actual = this.anioSeleccionado();
    if (actual > this.anioActual - 4) this.anioSeleccionado.set(actual - 1);
  }

  anioSiguiente(): void {
    const actual = this.anioSeleccionado();
    if (actual < this.anioActual) this.anioSeleccionado.set(actual + 1);
  }

  toggleAnioComparativo(anio: number): void {
    if (anio === this.anioSeleccionado()) return;
    const current = this.aniosComparativos();
    if (current.includes(anio)) {
      this.aniosComparativos.set(current.filter(a => a !== anio));
    } else if (current.length < 1) {
      this.aniosComparativos.set([...current, anio]);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────
  hayDatos = computed(() => this.misEntrenamientos().length > 0);

  formatFecha(fecha: string | null): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
npx tsc --noEmit
```
Expected: sin errores TypeScript.

- [ ] **Step 3: Commit**

```bash
rtk git add src/app/features/metricas/metricas.component.ts && rtk git commit -m "feat(metricas): add MetricasComponent TypeScript logic"
```

---

## Task 2: Crear el template HTML del componente

**Files:**
- Create: `src/app/features/metricas/metricas.component.html`

- [ ] **Step 1: Crear el template HTML**

```html
<!-- src/app/features/metricas/metricas.component.html -->

<!-- ── Selector de año (sticky bajo header de la app) ──────────── -->
<div class="metricas-anio-bar">
  <button class="metricas-anio-bar__btn" (click)="anioAnterior()" [disabled]="anioSeleccionado() <= anioActual - 4">
    <i class="bi bi-chevron-left"></i>
  </button>
  <span class="metricas-anio-bar__anio">{{ anioSeleccionado() }}</span>
  <button class="metricas-anio-bar__btn" (click)="anioSiguiente()" [disabled]="anioSeleccionado() >= anioActual">
    <i class="bi bi-chevron-right"></i>
  </button>
</div>

<div class="metricas-container">

  <!-- ── Estado vacío ─────────────────────────────────────────── -->
  @if (!hayDatos()) {
    <app-empty-state
      icon="bi-graph-up"
      [title]="'Sin entrenamientos en ' + anioSeleccionado()"
      subtitle="Aún no tienes entrenamientos registrados este año">
    </app-empty-state>
  }

  @if (hayDatos()) {

    <!-- ── 1. KPIs 2×2 ──────────────────────────────────────── -->
    <div class="metricas-kpis">
      <div class="metricas-kpi">
        <span class="metricas-kpi__label">Media anual</span>
        <span class="metricas-kpi__valor">{{ mediaAnual() | number:'1.1-1' }} <small>/25</small></span>
        <span class="metricas-kpi__sub text-gray-500">vs club: {{ mediaClub() | number:'1.1-1' }}</span>
      </div>
      <div class="metricas-kpi">
        <span class="metricas-kpi__label">Sesiones</span>
        <span class="metricas-kpi__valor">{{ totalSesiones() }}</span>
        <span class="metricas-kpi__sub text-gray-500">entrenamientos</span>
      </div>
      <div class="metricas-kpi">
        <span class="metricas-kpi__label">Mejor resultado</span>
        <span class="metricas-kpi__valor">{{ mejorResultado() }} <small>/25</small></span>
        <span class="metricas-kpi__sub text-gray-500">{{ formatFecha(fechaMejorResultado()) }}</span>
      </div>
      <div class="metricas-kpi">
        <span class="metricas-kpi__label">Posición club</span>
        @if (posicionClub(); as pos) {
          <span class="metricas-kpi__valor">#{{ pos.posicion }}</span>
          <span class="metricas-kpi__sub text-gray-500">de {{ pos.total }} socios</span>
        } @else {
          <span class="metricas-kpi__valor">—</span>
        }
      </div>
    </div>

    <!-- ── 2. Evolución temporal ────────────────────────────── -->
    <div class="metricas-card">
      <div class="metricas-card__header">
        <h3 class="metricas-card__title">Evolución mensual</h3>
        <div class="metricas-card__actions">
          @for (anio of aniosDisponibles; track anio) {
            @if (anio !== anioSeleccionado()) {
              <button
                class="metricas-btn-comparar"
                [class.metricas-btn-comparar--activo]="aniosComparativos().includes(anio)"
                (click)="toggleAnioComparativo(anio)">
                {{ anio }}
              </button>
            }
          }
        </div>
      </div>

      <svg class="metricas-svg" viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
        <!-- Línea media club (referencia gris punteado) -->
        @if (svgLineaClub()) {
          <polyline
            [attr.points]="svgLineaClub()"
            fill="none" stroke="#94A3B8" stroke-width="1"
            stroke-dasharray="4 3" opacity="0.6" />
        }
        <!-- Líneas del socio y comparativas -->
        @for (linea of svgLineas(); track linea!.anio) {
          <polyline
            [attr.points]="linea!.points"
            fill="none"
            [attr.stroke]="linea!.color"
            stroke-width="2"
            [attr.stroke-dasharray]="linea!.punteado ? '4 3' : 'none'" />
          @for (dot of linea!.dots; track dot.mes) {
            <circle [attr.cx]="dot.x" [attr.cy]="dot.y" r="3" [attr.fill]="linea!.color" />
            <title>{{ mesesAbrev[dot.mes] }}: {{ dot.media | number:'1.1-1' }}/25</title>
          }
        }
        <!-- Eje X: etiquetas meses -->
        @for (mes of mesesAbrev; track $index) {
          <text
            [attr.x]="30 + ($index / 11) * 240"
            y="118"
            text-anchor="middle"
            font-size="7"
            fill="#94A3B8">{{ mes }}</text>
        }
      </svg>

      <!-- Leyenda -->
      <div class="metricas-leyenda">
        <span class="metricas-leyenda__item">
          <span class="metricas-leyenda__dot" style="background:#FFAE00"></span>
          {{ anioSeleccionado() }}
        </span>
        @for (anio of aniosComparativos(); track anio) {
          <span class="metricas-leyenda__item">
            <span class="metricas-leyenda__dot" style="background:#60A5FA"></span>
            {{ anio }}
          </span>
        }
        <span class="metricas-leyenda__item">
          <span class="metricas-leyenda__dot metricas-leyenda__dot--punteado"></span>
          Media club
        </span>
      </div>
    </div>

    <!-- ── 3. Heatmap esquemas (1–10) ────────────────────────── -->
    <div class="metricas-card">
      <h3 class="metricas-card__title">Rendimiento por esquema</h3>

      <div class="metricas-esquema__grid">
        @for (celda of heatmapEsquemas(); track celda.esquema) {
          <button
            [class]="claseCeldaEsquema(celda)"
            (click)="seleccionarEsquema(celda.esquema)"
            [attr.aria-pressed]="esquemaSeleccionado() === celda.esquema">
            <span class="metricas-esquema__num">{{ celda.esquema }}</span>
            @if (celda.mediaPlatos !== null) {
              <span class="metricas-esquema__media">{{ celda.mediaPlatos | number:'1.1-1' }}</span>
              <span class="metricas-esquema__sesiones">{{ celda.sesiones }}s</span>
            } @else {
              <span class="metricas-esquema__vacia">—</span>
            }
          </button>
        }
      </div>

      @if (esquemaSeleccionado() !== null) {
        <div class="metricas-filtro-chip">
          <span>Esquema {{ esquemaSeleccionado() }} activo</span>
          <button (click)="seleccionarEsquema(esquemaSeleccionado()!)" aria-label="Quitar filtro">
            <i class="bi bi-x"></i>
          </button>
        </div>
      }
    </div>

    <!-- ── 4. Heatmap platos (1–25) ──────────────────────────── -->
    <div class="metricas-card">
      <h3 class="metricas-card__title">Fallos por plato</h3>

      <!-- Cabecera de puestos -->
      <div class="metricas-fallos__cabecera">
        @for (p of [1,2,3,4,5]; track p) {
          <span>P{{ p }}</span>
        }
      </div>

      <div class="metricas-fallos__grid">
        @for (celda of heatmapFallos(); track celda.plato) {
          <div [class]="claseCeldaFallo(celda)" [title]="celda.veces > 0 ? celda.veces + ' fallos' : ''">
            <span class="metricas-fallos__num">{{ celda.plato }}</span>
            <span class="metricas-fallos__veces">{{ celda.veces > 0 ? celda.veces : '—' }}</span>
          </div>
        }
      </div>

      <!-- Resumen textual -->
      <div class="metricas-fallos__resumen">
        @if (platosMasFallados().length === 0) {
          <p class="text-green-600 font-medium">¡Sin fallos registrados este año!</p>
        } @else {
          @if (puestoMasDebil() !== null) {
            <p>Tu punto más débil: <strong>puesto {{ puestoMasDebil() }}</strong></p>
          }
          <p>Platos con más fallos: <strong>{{ platosMasFallados().join(', ') }}</strong></p>
        }
      </div>
    </div>

    <!-- ── 5. Análisis por puesto (1–6) ─────────────────────── -->
    <div class="metricas-card">
      <h3 class="metricas-card__title">Análisis por puesto</h3>

      <div class="metricas-puestos">
        @for (p of analisisPuestos(); track p.puesto) {
          <div class="metricas-puesto">
            <div class="metricas-puesto__label">
              <span>Puesto {{ p.puesto }}</span>
              @if (mejorPuesto() === p.puesto) { <span class="metricas-puesto__star">★</span> }
              @if (peorPuesto() === p.puesto) { <span class="metricas-puesto__peor">↓</span> }
            </div>
            <div class="metricas-puesto__barra-wrap">
              @if (p.media !== null) {
                <div class="metricas-puesto__barra"
                  [style.width.%]="(p.media / 25) * 100">
                </div>
                <span class="metricas-puesto__valor">{{ p.media | number:'1.1-1' }}</span>
              } @else {
                <span class="metricas-puesto__sin-datos">Sin datos</span>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ── 6. Racha y consistencia ───────────────────────────── -->
    <div class="metricas-card metricas-racha">
      <h3 class="metricas-card__title">Racha y consistencia</h3>

      <div class="metricas-racha__grid">
        <div class="metricas-racha__item">
          <span class="metricas-racha__num">{{ mejorRacha() }}</span>
          <span class="metricas-racha__label">Mejor racha</span>
          <span class="metricas-racha__sub">sesiones &gt; tu media</span>
        </div>
        <div class="metricas-racha__item">
          @if (consistencia(); as c) {
            <span class="metricas-racha__num">σ {{ c.std }}</span>
            <span class="metricas-racha__label">Consistencia</span>
            <span class="metricas-racha__sub">{{ c.label }}</span>
          } @else {
            <span class="metricas-racha__num">—</span>
            <span class="metricas-racha__label">Consistencia</span>
          }
        </div>
        <div class="metricas-racha__item metricas-racha__sparkline-wrap">
          <span class="metricas-racha__label">Últimas 5 sesiones</span>
          @if (svgSparkline()) {
            <svg class="metricas-sparkline" viewBox="0 0 80 30" xmlns="http://www.w3.org/2000/svg">
              <polyline [attr.points]="svgSparkline()" fill="none" stroke="#FFAE00" stroke-width="2" />
            </svg>
            <div class="metricas-sparkline__valores">
              @for (s of tendenciaReciente(); track s.fecha) {
                <span>{{ s.platos }}</span>
              }
            </div>
          } @else {
            <span class="metricas-racha__sub">Sin datos suficientes</span>
          }
        </div>
      </div>
    </div>

  }

</div>
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
rtk git add src/app/features/metricas/metricas.component.html && rtk git commit -m "feat(metricas): add MetricasComponent HTML template"
```

---

## Task 3: Crear los estilos SCSS del componente

**Files:**
- Create: `src/app/features/metricas/metricas.component.scss`

- [ ] **Step 1: Crear estilos SCSS**

```scss
// src/app/features/metricas/metricas.component.scss

// ── Variables ───────────────────────────────────────────────────
$primary: #FFAE00;
$secondary: #002F86;
$success: #10B981;
$error: #EF4444;
$text-muted: #94A3B8;

// ── Barra selector de año ───────────────────────────────────────
.metricas-anio-bar {
  position: sticky;
  top: 56px; // altura del header principal de la app
  z-index: 10;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.5rem 1rem;

  &__btn {
    background: none;
    border: none;
    cursor: pointer;
    color: $primary;
    font-size: 1.1rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    &:disabled { color: $text-muted; cursor: not-allowed; }
    &:not(:disabled):hover { background: #FFF8E6; }
  }

  &__anio {
    font-size: 1.125rem;
    font-weight: 700;
    min-width: 4rem;
    text-align: center;
  }
}

// ── Contenedor principal ────────────────────────────────────────
.metricas-container {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 5rem; // espacio para bottom-nav
}

// ── Card base ───────────────────────────────────────────────────
.metricas-card {
  background: #fff;
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  &__title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #374151;
    margin: 0 0 0.75rem;
  }

  &__actions {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
}

// ── KPIs grid 2×2 ───────────────────────────────────────────────
.metricas-kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.metricas-kpi {
  background: #fff;
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 0.125rem;

  &__label {
    font-size: 0.7rem;
    font-weight: 600;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  &__valor {
    font-size: 1.5rem;
    font-weight: 800;
    color: #111827;
    line-height: 1.2;

    small {
      font-size: 0.875rem;
      font-weight: 500;
      color: $text-muted;
    }
  }

  &__sub {
    font-size: 0.7rem;
  }
}

// ── Botón de año comparativo ────────────────────────────────────
.metricas-btn-comparar {
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 1rem;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  cursor: pointer;
  color: #374151;
  transition: all 0.15s;

  &--activo {
    background: #DBEAFE;
    border-color: #60A5FA;
    color: #1D4ED8;
    font-weight: 600;
  }
}

// ── SVG gráfico evolución ───────────────────────────────────────
.metricas-svg {
  width: 100%;
  height: auto;
  display: block;
  margin-bottom: 0.5rem;
}

// ── Leyenda ──────────────────────────────────────────────────────
.metricas-leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;

  &__item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    color: #6b7280;
  }

  &__dot {
    width: 10px;
    height: 4px;
    border-radius: 2px;
    display: inline-block;

    &--punteado {
      background: repeating-linear-gradient(to right, #94A3B8 0, #94A3B8 3px, transparent 3px, transparent 7px);
    }
  }
}

// ── Heatmap esquemas ─────────────────────────────────────────────
.metricas-esquema__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.35rem;
}

.metricas-esquema__celda {
  aspect-ratio: 1;
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s;
  padding: 0.25rem;

  &:active { transform: scale(0.96); }

  &--vacia { background: #F3F4F6; color: $text-muted; }
  &--bajo  { background: rgba($error, 0.15); color: darken($error, 15%); }
  &--medio { background: rgba($primary, 0.18); color: darken($primary, 20%); }
  &--alto  { background: rgba($success, 0.18); color: darken($success, 10%); }
  &--activa { border-color: $secondary !important; }
}

.metricas-esquema__num    { font-size: 1rem; font-weight: 800; line-height: 1; }
.metricas-esquema__media  { font-size: 0.6rem; font-weight: 600; }
.metricas-esquema__sesiones { font-size: 0.55rem; color: $text-muted; }
.metricas-esquema__vacia  { font-size: 0.75rem; }

// ── Chip filtro activo ───────────────────────────────────────────
.metricas-filtro-chip {
  margin-top: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 1rem;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  color: #1D4ED8;

  button {
    background: none;
    border: none;
    cursor: pointer;
    color: #1D4ED8;
    display: flex;
    align-items: center;
    font-size: 0.85rem;
    padding: 0;
  }
}

// ── Heatmap fallos ───────────────────────────────────────────────
.metricas-fallos__cabecera {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 0.25rem;
  gap: 0.25rem;

  span {
    text-align: center;
    font-size: 0.65rem;
    font-weight: 700;
    color: $text-muted;
    text-transform: uppercase;
  }
}

.metricas-fallos__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.25rem;
}

.metricas-fallos__celda {
  aspect-ratio: 1;
  border-radius: 0.375rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  &--cero  { background: #F0FDF4; }
  &--bajo  { background: rgba($error, 0.12); }
  &--medio { background: rgba($error, 0.35); }
  &--alto  { background: rgba($error, 0.65); color: #fff; }
}

.metricas-fallos__num   { font-size: 0.65rem; font-weight: 700; line-height: 1; }
.metricas-fallos__veces { font-size: 0.55rem; color: inherit; }

.metricas-fallos__resumen {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: #374151;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

// ── Análisis por puesto ──────────────────────────────────────────
.metricas-puestos {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metricas-puesto {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  &__label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    min-width: 4.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  &__star { color: $primary; font-size: 0.85rem; }
  &__peor { color: $error; font-size: 0.85rem; }

  &__barra-wrap {
    flex: 1;
    height: 1.25rem;
    background: #F3F4F6;
    border-radius: 0.25rem;
    position: relative;
    overflow: visible;
    display: flex;
    align-items: center;
  }

  &__barra {
    height: 100%;
    background: $primary;
    border-radius: 0.25rem;
    min-width: 4px;
    transition: width 0.3s;
  }

  &__valor {
    font-size: 0.7rem;
    font-weight: 700;
    margin-left: 0.35rem;
    color: #111827;
  }

  &__sin-datos {
    font-size: 0.7rem;
    color: $text-muted;
    padding-left: 0.5rem;
  }
}

// ── Racha y consistencia ────────────────────────────────────────
.metricas-racha {
  &__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.1rem;
  }

  &__sparkline-wrap {
    grid-column: 1 / -1;
  }

  &__num {
    font-size: 1.5rem;
    font-weight: 800;
    color: $primary;
    line-height: 1.2;
  }

  &__label {
    font-size: 0.7rem;
    font-weight: 700;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__sub {
    font-size: 0.65rem;
    color: $text-muted;
  }
}

// ── Sparkline ───────────────────────────────────────────────────
.metricas-sparkline {
  width: 100%;
  max-width: 120px;
  height: 40px;
}

.metricas-sparkline__valores {
  display: flex;
  justify-content: space-around;
  width: 100%;
  max-width: 120px;
  font-size: 0.6rem;
  color: #374151;
  font-weight: 600;
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add src/app/features/metricas/metricas.component.scss && rtk git commit -m "feat(metricas): add MetricasComponent SCSS styles"
```

---

## Task 4: Actualizar rutas y bottom-nav

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/shared/components/bottom-nav/bottom-nav.component.ts`

- [ ] **Step 1: Actualizar `app.routes.ts`**

Reemplazar el bloque de ruta `/perfil`:
```typescript
{
  path: 'perfil',
  loadComponent: () =>
    import('./features/perfil/perfil.component').then(m => m.PerfilComponent),
},
```
Por:
```typescript
{
  path: 'metricas',
  loadComponent: () =>
    import('./features/metricas/metricas.component').then(m => m.MetricasComponent),
},
```

- [ ] **Step 2: Actualizar `bottom-nav.component.ts`**

En `SOCIO_NAV`, cambiar:
```typescript
{ route: '/perfil', icon: 'bi-graph-up', label: 'Métricas' },
```
Por:
```typescript
{ route: '/metricas', icon: 'bi-graph-up', label: 'Métricas' },
```

En `ADMIN_NAV`, cambiar:
```typescript
{ route: '/perfil', icon: 'bi-gear', label: 'Admin' },
```
Por:
```typescript
{ route: '/metricas', icon: 'bi-gear', label: 'Admin' },
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
rtk git add src/app/app.routes.ts src/app/shared/components/bottom-nav/bottom-nav.component.ts && rtk git commit -m "feat(metricas): update routes and bottom-nav to /metricas"
```

---

## Task 5: Eliminar `PerfilComponent`

**Files:**
- Delete: `src/app/features/perfil/perfil.component.ts`
- Delete: `src/app/features/perfil/perfil.component.html`
- Delete: `src/app/features/perfil/perfil.component.scss`

> **Nota**: El admin sigue teniendo acceso a `/metricas` desde el bottom-nav (apunta al mismo lugar que antes).

- [ ] **Step 1: Verificar que no hay imports del perfil**

```bash
rtk grep "perfil.component\|PerfilComponent" src/app --context 1
```
Expected: solo los archivos del propio componente (`perfil.component.ts`, etc.) — ningún otro import externo.

- [ ] **Step 2: Eliminar el directorio**

```bash
rm -rf src/app/features/perfil
```

- [ ] **Step 3: Verificar compilación limpia**

```bash
npx tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
rtk git add -A && rtk git commit -m "feat(metricas): remove PerfilComponent, replaced by MetricasComponent"
```

---

## Task 6: Verificación en navegador

- [ ] **Step 1: Levantar servidor de desarrollo**

```bash
npm start
```

- [ ] **Step 2: Navegar a `/metricas` (o pulsar "Métricas" en bottom-nav)**

Verificar:
- El selector de año funciona (‹ y ›)
- Los 4 KPIs se muestran con valores correctos
- El gráfico SVG de evolución se renderiza
- El heatmap de esquemas (10 celdas) se muestra y los colores responden al rendimiento
- Tap en celda de esquema activa el filtro y aparece el chip
- El heatmap de platos (25 celdas, 5 columnas) se muestra
- El análisis por puesto muestra barras horizontales
- La sección de racha/consistencia muestra valores y sparkline
- El layout no desborda horizontalmente en móvil

- [ ] **Step 3: Verificar estado vacío**

Cambiar el año a uno sin datos (ej. 2020). Debe aparecer el `EmptyStateComponent`.

- [ ] **Step 4: Verificar la ruta `/perfil` redirige correctamente**

Navegar a `/perfil` directamente. Debe redirigir a `/` (el `**` catch-all lleva a home).

---

## Self-review del plan

**Spec coverage:**
- ✅ Ruta `/metricas` — Task 4
- ✅ Header sticky con selector de año — Task 2 (`.metricas-anio-bar`)
- ✅ KPIs 2×2 (media, sesiones, mejor resultado, posición club) — Task 1 + 2
- ✅ Gráfico SVG evolución mensual con línea club + comparativa — Task 1 + 2
- ✅ Heatmap esquemas 1–10, colores por rendimiento, filtro activo — Task 1 + 2
- ✅ Chip filtro de esquema — Task 2
- ✅ Heatmap platos 1–25, agrupados por puesto P1–P5 — Task 1 + 2
- ✅ Texto resumen de fallos (puesto débil, platos más fallados) — Task 2
- ✅ Análisis por puesto 1–6 con barras — Task 1 + 2
- ✅ Racha, consistencia, sparkline 5 sesiones — Task 1 + 2
- ✅ Estado vacío — Task 2
- ✅ Eliminación de PerfilComponent — Task 5
- ✅ Actualización bottom-nav — Task 4

**Placeholder scan:** ninguno.

**Type consistency:** `ResultadoEntrenamientoConFecha` de `entrenamiento.model.ts` se usa igual que en el componente original. Los métodos `getByUser`, `getRankingAnual`, `getFallosByUserAndYear` son los ya existentes en `EntrenamientoService`.
