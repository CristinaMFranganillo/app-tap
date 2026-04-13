import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { TorneoService } from '../torneo.service';
import { InscripcionTorneoService } from '../inscripcion-torneo.service';
import { Torneo } from '../../../../core/models/torneo.model';
import { InscritoVista } from '../../../../core/models/inscripcion-torneo.model';

@Component({
  selector: 'app-form-escuadra-torneo',
  standalone: true,
  imports: [],
  templateUrl: './form-escuadra-torneo.component.html',
  styleUrl: './form-escuadra-torneo.component.scss',
})
export class FormEscuadraTorneoComponent {
  private escuadraService = inject(EscuadraService);
  private authService     = inject(AuthService);
  private torneoService   = inject(TorneoService);
  private inscService     = inject(InscripcionTorneoService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);

  torneo = signal<Torneo | null>(null);
  inscritosLibres = signal<InscritoVista[]>([]);

  // Array de ids de inscripciones por puesto ('' = vacío)
  inscripcionIds: string[] = ['', '', '', '', '', ''];

  loading = false;
  error   = '';

  constructor() {
    const torneoId = this.route.snapshot.paramMap.get('id')!;
    firstValueFrom(this.torneoService.getById(torneoId)).then(t => this.torneo.set(t));
    this.inscService.listarInscritos(torneoId).then(all => {
      this.inscritosLibres.set(all.filter(i => !i.enEscuadra));
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  get tarifaSocio(): number { return this.torneo()?.precioInscripcionSocio ?? 0; }
  get tarifaNoSocio(): number { return this.torneo()?.precioInscripcionNoSocio ?? 0; }

  opcionesPara(index: number): InscritoVista[] {
    return this.inscritosLibres().filter(i =>
      !this.inscripcionIds.some((id, j) => j !== index && id === i.id)
    );
  }

  inscritoDe(index: number): InscritoVista | null {
    const id = this.inscripcionIds[index];
    if (!id) return null;
    return this.inscritosLibres().find(i => i.id === id) ?? null;
  }

  onSelectInscrito(index: number, event: Event): void {
    this.inscripcionIds[index] = (event.target as HTMLSelectElement).value;
  }

  get asignadosCount(): number {
    return this.inscripcionIds.filter(id => !!id).length;
  }

  get countSocios(): number {
    return this.inscripcionIds
      .map((_, i) => this.inscritoDe(i))
      .filter((i): i is InscritoVista => i !== null && !i.esNoSocio)
      .length;
  }

  get countNoSocios(): number {
    return this.inscripcionIds
      .map((_, i) => this.inscritoDe(i))
      .filter((i): i is InscritoVista => i !== null && i.esNoSocio)
      .length;
  }

  get totalEscuadra(): number {
    return this.countSocios * this.tarifaSocio + this.countNoSocios * this.tarifaNoSocio;
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.asignadosCount === 0) {
      this.error = 'Asigna al menos un tirador';
      return;
    }

    this.loading = true;
    this.error   = '';

    try {
      const torneoId  = this.route.snapshot.paramMap.get('id')!;
      const torneo    = this.torneo() ?? await firstValueFrom(this.torneoService.getById(torneoId));
      const escuadras = await firstValueFrom(this.escuadraService.getByTorneo(torneoId));
      const escuadraId = await this.escuadraService.createEscuadraTorneo(
        torneoId, escuadras.length + 1
      );

      const seleccionados: (InscritoVista | null)[] = this.inscripcionIds.map((_, i) => this.inscritoDe(i));

      // 1. Añadir tiradores
      for (let i = 0; i < 6; i++) {
        const sel = seleccionados[i];
        if (!sel) continue;
        if (sel.esNoSocio) {
          await this.escuadraService.addNoSocio(escuadraId, `${sel.nombre} ${sel.apellidos}`, i + 1);
        } else {
          await this.escuadraService.addTirador(escuadraId, sel.userId!, i + 1);
        }
      }

      // 2. Registrar caja (una fila por tirador con su precio snapshot)
      const fecha       = torneo.fecha;
      const registrador = this.authService.currentUser!.id;
      const movimientos = seleccionados
        .filter((s): s is InscritoVista => s !== null)
        .map(s => ({
          userId:        s.esNoSocio ? undefined : s.userId,
          nombreTirador: `${s.apellidos}, ${s.nombre}`,
          esNoSocio:     s.esNoSocio,
          importe:       s.precioPagado,
        }));

      await this.escuadraService.registrarCajaEscuadra(
        escuadraId, null, fecha, registrador, movimientos, torneoId
      );

      this.router.navigate([
        '/admin/torneos', torneoId,
        'escuadra', escuadraId, 'resultados',
      ]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    const torneoId = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/torneos', torneoId]);
  }
}
