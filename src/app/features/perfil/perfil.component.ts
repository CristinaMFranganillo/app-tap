import { Component, inject, computed, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, combineLatest, EMPTY, forkJoin, of, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { CuotaService } from '../admin/socios/cuota.service';
import { ContabilidadService, ResumenFinanciero } from '../admin/contabilidad/contabilidad.service';
import { ResultadoEntrenamientoConFecha } from '../../core/models/entrenamiento.model';

import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [EmptyStateComponent, DecimalPipe],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);
  private cuotaService = inject(CuotaService);
  private contabilidadService = inject(ContabilidadService);
  private router = inject(Router);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  // ── Bifurcación por rol ────────────────────────────────────────
  esAdmin = computed(() => {
    const rol = this.user()?.rol;
    return rol === 'admin' || rol === 'moderador';
  });

  // ══════════════════════════════════════════════════════════════════
  // ADMIN: Administración financiera
  // ══════════════════════════════════════════════════════════════════

  anioAdmin = new Date().getFullYear();
  resumen = signal<ResumenFinanciero | null>(null);
  cargandoResumen = signal(true);
  errorAdmin = signal('');

  balanceTotal = computed(() => {
    const r = this.resumen();
    if (!r) return 0;
    return r.ingresosCuotas + r.ingresosEscuadras + r.ingresosTorneos + r.ingresosVarios - r.gastos;
  });

  totalIngresos = computed(() => {
    const r = this.resumen();
    if (!r) return 0;
    return r.ingresosCuotas + r.ingresosEscuadras + r.ingresosTorneos + r.ingresosVarios;
  });

  async ngOnInit(): Promise<void> {
    if (this.esAdmin()) {
      await this.cargarDatosAdmin();
    }
  }

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

  // ── Navegación admin ────────────────────────────────────────────

  irSocios(): void { this.router.navigate(['/admin/socios']); }
  irTemporadas(): void { this.router.navigate(['/admin/temporadas']); }
  irCaja(): void { this.router.navigate(['/admin/caja']); }
  irTorneos(): void { this.router.navigate(['/admin/torneos']); }
  irEntrenamientos(): void { this.router.navigate(['/admin/scores']); }
  irContabilidad(): void { this.router.navigate(['/admin/contabilidad']); }

  // ══════════════════════════════════════════════════════════════════
  // SOCIO: Entrenamientos personales
  // ══════════════════════════════════════════════════════════════════

  anioActual = new Date().getFullYear();
  anioSeleccionado = signal(this.anioActual);
  anios = Array.from({ length: 3 }, (_, i) => this.anioActual - i);

  esquemaSeleccionado = signal<number | null>(null);

  seleccionarEsquema(esquema: number): void {
    this.esquemaSeleccionado.set(this.esquemaSeleccionado() === esquema ? null : esquema);
  }

  aniosComparativos = signal<number[]>([]);

  toggleAnioComparativo(anio: number): void {
    if (anio === this.anioSeleccionado()) return;
    const current = this.aniosComparativos();
    if (current.includes(anio)) {
      this.aniosComparativos.set(current.filter(a => a !== anio));
    } else if (current.length < 2) {
      this.aniosComparativos.set([...current, anio]);
    }
  }

  misEntrenamientos = toSignal(
    combineLatest([
      this.authService.currentUser$,
      toObservable(this.anioSeleccionado),
    ]).pipe(
      switchMap(([u, year]) =>
        u?.id ? this.entrenamientoService.getByUser(u.id, year) : EMPTY
      )
    ),
    { initialValue: [] }
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
    { initialValue: [] }
  );

  entrenamientosFiltrados = computed(() => {
    const esq = this.esquemaSeleccionado();
    const list = this.misEntrenamientos();
    if (esq === null) return list;
    return list.filter(r => r.esquema === esq);
  });

  totalEntrenamientos = computed(() => this.misEntrenamientos().length);

  totalFiltrados = computed(() => this.entrenamientosFiltrados().length);

  mediaEntrenamientos = computed(() => {
    const list = this.entrenamientosFiltrados();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, r) => acc + r.platosRotos, 0);
    return Math.round((sum / list.length) * 10) / 10;
  });

  mejorResultado = computed(() =>
    this.entrenamientosFiltrados().reduce((max, r) => Math.max(max, r.platosRotos), 0)
  );

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
    const sum = ranking.reduce((acc, r) => acc + r.mediaPlatos, 0);
    return Math.round((sum / ranking.length) * 10) / 10;
  });

  heatmapEsquemas = computed(() => {
    const list = this.misEntrenamientos();
    const buckets = new Map<number, number[]>();
    for (let e = 1; e <= 10; e++) buckets.set(e, []);
    for (const r of list) {
      if (r.esquema && r.esquema >= 1 && r.esquema <= 10) {
        buckets.get(r.esquema)!.push(r.platosRotos);
      }
    }
    return Array.from(buckets.entries()).map(([esquema, arr]) => {
      if (arr.length === 0) return { esquema, sesiones: 0, mediaPlatos: null as number | null };
      const sum = arr.reduce((a, b) => a + b, 0);
      return {
        esquema,
        sesiones: arr.length,
        mediaPlatos: Math.round((sum / arr.length) * 10) / 10,
      };
    });
  });

  mejorEsquema = computed(() => {
    const con = this.heatmapEsquemas().filter(c => c.mediaPlatos !== null);
    if (con.length === 0) return null;
    return con.reduce((max, c) => c.mediaPlatos! > max.mediaPlatos! ? c : max);
  });

  peorEsquema = computed(() => {
    const con = this.heatmapEsquemas().filter(c => c.mediaPlatos !== null);
    if (con.length === 0) return null;
    return con.reduce((min, c) => c.mediaPlatos! < min.mediaPlatos! ? c : min);
  });

  claseCelda(celda: { esquema: number; sesiones: number; mediaPlatos: number | null }): string {
    const classes: string[] = ['perfil-heatmap__celda'];
    const m = celda.mediaPlatos;
    if (m === null) classes.push('bg-neutral-100');
    else if (m < 10) classes.push('bg-red-200');
    else if (m < 16) classes.push('bg-orange-200');
    else if (m < 20) classes.push('bg-yellow-200');
    else if (m < 23) classes.push('bg-green-200');
    else classes.push('bg-green-400');

    const mejor = this.mejorEsquema();
    const peor  = this.peorEsquema();
    if (mejor && celda.esquema === mejor.esquema) classes.push('perfil-heatmap__celda--mejor');
    else if (peor && peor.esquema !== mejor?.esquema && celda.esquema === peor.esquema) {
      classes.push('perfil-heatmap__celda--peor');
    }
    if (this.esquemaSeleccionado() === celda.esquema) classes.push('perfil-heatmap__celda--activo');
    return classes.join(' ');
  }

  readonly mesesAbrev = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

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
    const comp = this.entrenamientosComparativos();
    for (const [year, list] of comp.entries()) {
      result.set(year, this.calcularMediasMensuales(filtrar(list)));
    }
    return result;
  });

  svgEvolucion = computed(() => {
    const data = this.evolucionMensual();
    const W = 300, H = 120, PAD_X = 30, PAD_Y = 8;
    const colores = [
      { anio: this.anioSeleccionado(), color: '#FFAE00' },
      ...this.aniosComparativos().map((a, i) =>
        ({ anio: a, color: i === 0 ? '#60A5FA' : '#A78BFA' })
      )
    ];
    const lineas: { anio: number; color: string; points: string; dots: { x: number; y: number; media: number }[] }[] = [];

    for (const { anio, color } of colores) {
      const medias = data.get(anio);
      if (!medias) continue;
      const dots: { x: number; y: number; media: number }[] = [];
      for (let m = 0; m < 12; m++) {
        if (medias[m] === null) continue;
        const x = PAD_X + (m / 11) * (W - PAD_X * 2);
        const y = H - PAD_Y - ((medias[m]! / 25) * (H - PAD_Y * 2));
        dots.push({ x, y, media: medias[m]! });
      }
      const points = dots.map(d => `${d.x},${d.y}`).join(' ');
      lineas.push({ anio, color, points, dots });
    }
    return lineas;
  });

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

  fallosFiltrados = computed(() => {
    const esq = this.esquemaSeleccionado();
    const list = this.misFallosAnuales();
    if (esq === null) return list;
    return list.filter(f => f.esquema === esq);
  });

  totalFallos = computed(() => this.fallosFiltrados().length);

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

  platoMasFallado = computed(() => {
    const con = this.heatmapFallos().filter(c => c.veces > 0);
    if (con.length === 0) return null;
    return con.reduce((max, c) => c.veces > max.veces ? c : max);
  });

  platoMenosFallado = computed(() => {
    const con = this.heatmapFallos().filter(c => c.veces > 0);
    if (con.length <= 1) return null;
    return con.reduce((min, c) => c.veces < min.veces ? c : min);
  });

  platosMasFallados = computed(() => {
    const con = this.heatmapFallos().filter(c => c.veces > 0);
    return con.sort((a, b) => b.veces - a.veces).slice(0, 3).map(c => c.plato);
  });

  platosMenosFallados = computed(() => {
    const con = this.heatmapFallos().filter(c => c.veces > 0);
    if (con.length <= 1) return [] as number[];
    return con.sort((a, b) => a.veces - b.veces).slice(0, 3).map(c => c.plato);
  });

  claseCeldaFallo(celda: { plato: number; veces: number; maxVeces: number }): string {
    const classes: string[] = ['perfil-fallos__celda'];
    const { veces, maxVeces } = celda;

    if (maxVeces === 0) {
      classes.push('bg-neutral-100');
    } else if (veces === 0) {
      classes.push('bg-green-200');
    } else {
      const pct = (veces / maxVeces) * 100;
      if (pct < 25) classes.push('bg-green-100');
      else if (pct < 50) classes.push('bg-yellow-100');
      else if (pct < 75) classes.push('bg-orange-200');
      else classes.push('bg-red-200');
    }

    const peor = this.platoMasFallado();
    const mejor = this.platoMenosFallado();
    if (peor && celda.plato === peor.plato) classes.push('perfil-fallos__celda--peor');
    else if (mejor && celda.plato === mejor.plato) classes.push('perfil-fallos__celda--mejor');

    return classes.join(' ');
  }

  // ── Común ───────────────────────────────────────────────────────

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }
}
