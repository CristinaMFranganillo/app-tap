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

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { AvatarEditorComponent } from '../../shared/components/avatar-editor/avatar-editor.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [AvatarComponent, AvatarEditorComponent, EmptyStateComponent, DecimalPipe],
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

  mostrarEditorAvatar = signal(false);

  abrirEditorAvatar(): void { this.mostrarEditorAvatar.set(true); }
  onAvatarCompletado(): void { this.mostrarEditorAvatar.set(false); }
  onAvatarOmitido(): void { this.mostrarEditorAvatar.set(false); }

  // ── Bifurcación por rol ────────────────────────────────────────
  esAdmin = computed(() => {
    const rol = this.user()?.rol;
    return rol === 'admin' || rol === 'moderador';
  });

  // ══════════════════════════════════════════════════════════════════
  // ADMIN: Administración financiera
  // ══════════════════════════════════════════════════════════════════

  tabAdmin = signal<'admin' | 'stats'>('admin');
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

  totalEntrenamientos = computed(() => this.misEntrenamientos().length);

  mediaEntrenamientos = computed(() => {
    const list = this.misEntrenamientos();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, r) => acc + r.platosRotos, 0);
    return Math.round((sum / list.length) * 10) / 10;
  });

  mejorResultado = computed(() =>
    this.misEntrenamientos().reduce((max, r) => Math.max(max, r.platosRotos), 0)
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
    for (let e = 1; e <= 7; e++) buckets.set(e, []);
    for (const r of list) {
      if (r.esquema && r.esquema >= 1 && r.esquema <= 7) {
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
    const result = new Map<number, (number | null)[]>();
    result.set(this.anioSeleccionado(), this.calcularMediasMensuales(this.misEntrenamientos()));
    const comp = this.entrenamientosComparativos();
    for (const [year, list] of comp.entries()) {
      result.set(year, this.calcularMediasMensuales(list));
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

  puntosSvg = computed(() => {
    const list = [...this.misEntrenamientos()].reverse();
    if (list.length < 2) return { points: '', dots: [] as { x: number; y: number; platos: number }[] };
    const W = 300;
    const H = 80;
    const PAD = 8;
    const xs = list.map((_, i) => PAD + (i / (list.length - 1)) * (W - PAD * 2));
    const ys = list.map(r => H - PAD - ((r.platosRotos / 25) * (H - PAD * 2)));
    const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
    const dots = xs.map((x, i) => ({ x, y: ys[i], platos: list[i].platosRotos }));
    return { points, dots };
  });

  // ── Común ───────────────────────────────────────────────────────

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }
}
