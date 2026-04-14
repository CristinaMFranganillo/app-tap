import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
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
  private torneoService   = inject(TorneoService);
  private inscService     = inject(InscripcionTorneoService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);

  torneo = signal<Torneo | null>(null);
  inscritosLibres = signal<InscritoVista[]>([]);

  // Array de ids de inscripciones por puesto ('' = vacío)
  inscripcionIds: string[] = ['', '', '', '', '', ''];

  numPlatos = 25;

  loading = false;
  error   = '';

  constructor() {
    const torneoId = this.route.snapshot.paramMap.get('id')!;
    firstValueFrom(this.torneoService.getById(torneoId)).then(t => this.torneo.set(t));
    this.cargarInscritos(torneoId);
  }

  private async cargarInscritos(torneoId: string): Promise<void> {
    const [all, escuadras] = await Promise.all([
      this.inscService.listarInscritos(torneoId),
      firstValueFrom(this.escuadraService.getByTorneo(torneoId)),
    ]);

    const userIdsOcupados = new Set<string>();
    const nombresOcupados = new Set<string>();
    for (const e of escuadras) {
      for (const t of e.tiradores ?? []) {
        if (t.esNoSocio && t.nombreExterno) {
          nombresOcupados.add(this.normaliza(t.nombreExterno));
        } else if (t.userId) {
          userIdsOcupados.add(t.userId);
        }
      }
    }

    const libres = all.filter(i => {
      if (i.enEscuadra) return false;
      if (i.esNoSocio) {
        return !nombresOcupados.has(this.normaliza(`${i.nombre} ${i.apellidos}`));
      }
      return !userIdsOcupados.has(i.userId!);
    });
    this.inscritosLibres.set(libres);
  }

  private normaliza(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  onNumPlatosChange(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val) && val > 0) this.numPlatos = val;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

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
      const escuadras = await firstValueFrom(this.escuadraService.getByTorneo(torneoId));
      const escuadraId = await this.escuadraService.createEscuadraTorneo(
        torneoId, escuadras.length + 1, this.numPlatos
      );

      const seleccionados: (InscritoVista | null)[] = this.inscripcionIds.map((_, i) => this.inscritoDe(i));

      for (let i = 0; i < 6; i++) {
        const sel = seleccionados[i];
        if (!sel) continue;
        if (sel.esNoSocio) {
          await this.escuadraService.addNoSocio(escuadraId, `${sel.nombre} ${sel.apellidos}`, i + 1);
        } else {
          await this.escuadraService.addTirador(escuadraId, sel.userId!, i + 1);
        }
      }

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
