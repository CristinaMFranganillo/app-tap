import { Component, inject, computed, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, combineLatest, EMPTY } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { EntrenamientoService } from '../admin/entrenamientos/entrenamiento.service';
import { CuotaService } from '../admin/socios/cuota.service';
import { ContabilidadService, ResumenFinanciero } from '../admin/contabilidad/contabilidad.service';
import { MovimientoManual } from '../../core/models/movimiento-manual.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { AvatarEditorComponent } from '../../shared/components/avatar-editor/avatar-editor.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [AvatarComponent, AvatarEditorComponent, EmptyStateComponent, DecimalPipe, FormsModule],
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
  movimientosManuales = signal<MovimientoManual[]>([]);
  cargandoResumen = signal(true);
  errorAdmin = signal('');

  // Formulario nuevo movimiento
  mostrarFormMovimiento = signal(false);
  tipoMovimiento = signal<'gasto' | 'ingreso'>('gasto');
  nuevoConcepto = '';
  nuevoImporte: number | null = null;
  nuevoFecha = new Date().toISOString().split('T')[0];
  guardando = signal(false);

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
    this.errorAdmin.set('');
    try {
      await this.contabilidadService.crearMovimiento(
        this.tipoMovimiento(),
        concepto,
        this.nuevoImporte,
        this.nuevoFecha,
        me.id
      );
      this.mostrarFormMovimiento.set(false);
      await this.cargarDatosAdmin();
    } catch (e: any) {
      this.errorAdmin.set(e.message);
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminarMovimientoManual(mov: MovimientoManual): Promise<void> {
    if (!confirm(`¿Eliminar ${mov.tipo === 'gasto' ? 'gasto' : 'ingreso'}: "${mov.concepto}"?`)) return;
    this.errorAdmin.set('');
    try {
      await this.contabilidadService.eliminarMovimiento(mov.id);
      await this.cargarDatosAdmin();
    } catch (e: any) {
      this.errorAdmin.set(e.message);
    }
  }

  // ── Navegación admin ────────────────────────────────────────────

  irSocios(): void { this.router.navigate(['/admin/socios']); }
  irTemporadas(): void { this.router.navigate(['/admin/temporadas']); }
  irCaja(): void { this.router.navigate(['/admin/caja']); }
  irTorneos(): void { this.router.navigate(['/admin/torneos']); }
  irEntrenamientos(): void { this.router.navigate(['/admin/scores']); }

  // ══════════════════════════════════════════════════════════════════
  // SOCIO: Entrenamientos personales
  // ══════════════════════════════════════════════════════════════════

  anioActual = new Date().getFullYear();
  anioSeleccionado = signal(this.anioActual);
  anios = Array.from({ length: 3 }, (_, i) => this.anioActual - i);

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
