import { Component, inject, signal, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TorneoService } from '../torneo.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { Torneo, ResultadoTorneo, RankingTorneo } from '../../../../core/models/torneo.model';
import { Escuadra, MovimientoCaja } from '../../../../core/models/escuadra.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { supabase } from '../../../../core/supabase/supabase.client';

export interface FilaResultado {
  puesto: number;
  nombre: string;
  esNoSocio: boolean;
  platosRotos: number;
  fallos: number[];
}

export interface EscuadraConResultados {
  escuadra: Escuadra;
  filas: FilaResultado[];
  total: number;
  totalCaja: number;
  cargando: boolean;
  expandida: boolean;
}

@Component({
  selector: 'app-detalle-torneo',
  standalone: true,
  imports: [DatePipe, DecimalPipe, EmptyStateComponent, ConfirmDialogComponent],
  templateUrl: './detalle-torneo.component.html',
  styleUrl: './detalle-torneo.component.scss',
})
export class DetalleTorneoComponent {
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private torneoService   = inject(TorneoService);
  private escuadraService = inject(EscuadraService);
  private userService     = inject(UserService);

  private id$ = this.route.paramMap.pipe(map(p => p.get('id')!));

  torneo = toSignal<Torneo | null>(
    this.id$.pipe(switchMap(id => this.torneoService.getById(id))),
    { initialValue: null }
  );

  ranking = toSignal(
    this.id$.pipe(switchMap(id => this.torneoService.getRanking(id))),
    { initialValue: [] as RankingTorneo[] }
  );

  private escuadrasRaw = toSignal(
    this.id$.pipe(switchMap(id => this.escuadraService.getByTorneo(id))),
    { initialValue: [] as Escuadra[] }
  );

  escuadrasConResultados = signal<EscuadraConResultados[]>([]);
  totalCajaDia           = signal(0);

  // Confirm dialog
  mostrarConfirm    = signal(false);
  escuadraAEliminar = signal<string | null>(null);

  constructor() {
    effect(async () => {
      const escuadras = this.escuadrasRaw();
      if (escuadras.length === 0) {
        this.escuadrasConResultados.set([]);
        this.totalCajaDia.set(0);
        return;
      }

      this.escuadrasConResultados.set(
        escuadras.map(e => ({
          escuadra: e, filas: [], total: 0, totalCaja: 0, cargando: true, expandida: false,
        }))
      );

      const socios = await firstValueFrom(this.userService.getAll());
      const escuadraIds = escuadras.map(e => e.id);

      const [resultados, fallosPorEscuadra, movCajaRes] = await Promise.all([
        Promise.all(escuadras.map(e =>
          firstValueFrom(this.torneoService.getResultadosByEscuadra(e.id))
        )),
        Promise.all(escuadras.map(e =>
          firstValueFrom(this.torneoService.getFallosByEscuadra(e.id))
        )),
        supabase
          .from('movimientos_caja')
          .select('*')
          .in('escuadra_id', escuadraIds)
          .order('created_at'),
      ]);

      // Mapa caja por escuadra
      const cajaMap = new Map<string, number>();
      for (const row of (movCajaRes.data ?? []) as any[]) {
        const mov: MovimientoCaja = {
          id: row['id'],
          escuadraId: row['escuadra_id'],
          userId: row['user_id'],
          nombreTirador: row['nombre_tirador'],
          esNoSocio: row['es_no_socio'],
          importe: row['importe'],
          fecha: row['fecha'],
          registradoPor: row['registrado_por'],
        };
        cajaMap.set(mov.escuadraId, (cajaMap.get(mov.escuadraId) ?? 0) + mov.importe);
      }

      let totalGeneral = 0;

      const items = escuadras.map((e, i) => {
        const fallosMap = new Map<string, number[]>();
        for (const f of fallosPorEscuadra[i]) {
          if (!fallosMap.has(f.userId)) fallosMap.set(f.userId, []);
          fallosMap.get(f.userId)!.push(f.numeroPlato);
        }

        const filas: FilaResultado[] = (resultados[i] as ResultadoTorneo[])
          .map(r => {
            const socio = socios.find(s => s.id === r.userId);
            const nombre = r.esNoSocio
              ? (r.nombreExterno ?? 'No socio')
              : (socio
                  ? `${socio.nombre} ${socio.apellidos}`
                  : r.userId ?? '—');
            return {
              puesto:      r.puesto,
              nombre,
              esNoSocio:   r.esNoSocio,
              platosRotos: r.platosRotos,
              fallos:      (r.userId ? fallosMap.get(r.userId) ?? [] : []).sort((a, b) => a - b),
            };
          })
          .sort((a, b) => a.puesto - b.puesto);

        const totalCaja = cajaMap.get(e.id) ?? 0;
        totalGeneral += totalCaja;

        return {
          escuadra: e,
          filas,
          total:     filas.reduce((s, f) => s + f.platosRotos, 0),
          totalCaja,
          cargando:  false,
          expandida: false,
        };
      });

      this.escuadrasConResultados.set(items);
      this.totalCajaDia.set(totalGeneral);
    });
  }

  toggleEscuadra(index: number): void {
    const items = this.escuadrasConResultados();
    this.escuadrasConResultados.set(
      items.map((item, i) => i === index ? { ...item, expandida: !item.expandida } : item)
    );
  }

  nuevaEscuadra(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/torneos', id, 'escuadra', 'nueva']);
  }

  irResultados(escuadraId: string): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/torneos', id, 'escuadra', escuadraId, 'resultados']);
  }

  irCaja(): void {
    this.router.navigate(['/admin/caja']);
  }

  goBack(): void {
    this.router.navigate(['/admin/torneos']);
  }

  // ── Eliminar escuadra ───────────────────────────────────────────

  pedirEliminar(escuadraId: string): void {
    this.escuadraAEliminar.set(escuadraId);
    this.mostrarConfirm.set(true);
  }

  cancelarEliminar(): void {
    this.mostrarConfirm.set(false);
    this.escuadraAEliminar.set(null);
  }

  async confirmarEliminar(): Promise<void> {
    const id = this.escuadraAEliminar();
    if (!id) return;
    this.mostrarConfirm.set(false);
    this.escuadraAEliminar.set(null);

    await this.torneoService.deleteEscuadraTorneo(id);

    // Eliminar la escuadra de la lista local
    this.escuadrasConResultados.set(
      this.escuadrasConResultados().filter(item => item.escuadra.id !== id)
    );
  }
}
