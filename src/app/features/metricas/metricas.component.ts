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

    const platosMap = new Map<number, number[]>();
    for (let p = 1; p <= 6; p++) platosMap.set(p, []);
    for (const r of resultados) {
      if (r.puesto >= 1 && r.puesto <= 6) platosMap.get(r.puesto)!.push(r.platosRotos);
    }

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
  mejorRacha = computed(() => {
    const list = [...this.misEntrenamientos()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const media = this.mediaAnual();
    if (list.length === 0) return 0;
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
