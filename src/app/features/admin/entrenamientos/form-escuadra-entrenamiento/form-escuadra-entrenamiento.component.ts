import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { User } from '../../../../core/models/user.model';
import { Tarifa } from '../../../../core/models/escuadra.model';

export interface PuestoVM {
  tipo: 'socio' | 'no_socio';
  userId?: string;
  nombreExterno?: string;
}

@Component({
  selector: 'app-form-escuadra-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-escuadra-entrenamiento.component.html',
  styleUrl: './form-escuadra-entrenamiento.component.scss',
})
export class FormEscuadraEntrenamientoComponent {
  private escuadraService = inject(EscuadraService);
  private userService     = inject(UserService);
  private authService     = inject(AuthService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);

  socios = toSignal(
    this.userService.getAll().pipe(
      map(users => users
        .filter(u => u.activo && u.rol !== 'admin')
        .sort((a, b) => {
          if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
          return `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es');
        })
      )
    ),
    { initialValue: [] as User[] }
  );

  tarifas = toSignal(this.escuadraService.getTarifas(), { initialValue: [] as Tarifa[] });

  puestos = signal<PuestoVM[]>(Array.from({ length: 6 }, () => ({ tipo: 'socio' as const })));
  searchText = signal<string[]>(Array(6).fill(''));
  dropdownOpen = signal<boolean[]>(Array(6).fill(false));

  loading = false;
  error   = '';

  // ── Helpers ──────────────────────────────────────────────────────────────

  tarifaSocio = computed(() => this.tarifas().find(t => t.tipo === 'socio')?.importe ?? 6);
  tarifaNoSocio = computed(() => this.tarifas().find(t => t.tipo === 'no_socio')?.importe ?? 7);

  asignados = computed(() => this.puestos().filter(p =>
    (p.tipo === 'socio' && !!p.userId?.trim()) || (p.tipo === 'no_socio')
  ));

  totalEscuadra = computed(() =>
    this.asignados().reduce((sum, p) =>
      sum + (p.tipo === 'socio' ? this.tarifaSocio() : this.tarifaNoSocio()), 0
    )
  );

  countSocios = computed(() => this.asignados().filter(p => p.tipo === 'socio').length);
  countNoSocios = computed(() => this.asignados().filter(p => p.tipo === 'no_socio').length);

  private sociosFiltradosSignals = Array.from({ length: 6 }, (_, i) =>
    computed<User[]>(() => {
      const ocupados = this.puestos()
        .filter((p, j) => j !== i && p.tipo === 'socio' && !!p.userId)
        .map(p => p.userId);
      const disponibles = this.socios().filter(s => !ocupados.includes(s.id));
      const term = (this.searchText()[i] ?? '').toLowerCase().trim();
      if (!term) return disponibles;
      return disponibles.filter(s =>
        `${s.apellidos} ${s.nombre} ${s.numeroSocio}`.toLowerCase().includes(term)
      );
    })
  );

  sociosFiltrados(index: number): User[] {
    return this.sociosFiltradosSignals[index]();
  }

  private updatePuesto(index: number, patch: Partial<PuestoVM> | PuestoVM, replace = false): void {
    this.puestos.update(arr => {
      const next = arr.slice();
      next[index] = replace ? (patch as PuestoVM) : { ...next[index], ...patch };
      return next;
    });
  }

  private updateSearch(index: number, value: string): void {
    this.searchText.update(arr => {
      const next = arr.slice();
      next[index] = value;
      return next;
    });
  }

  private updateDropdown(index: number, open: boolean): void {
    this.dropdownOpen.update(arr => {
      const next = arr.slice();
      next[index] = open;
      return next;
    });
  }

  onSearchFocus(index: number): void {
    if (this.puestos()[index].userId) {
      this.updateSearch(index, '');
    }
    this.updateDropdown(index, true);
  }

  onSearchBlur(index: number): void {
    setTimeout(() => {
      this.updateDropdown(index, false);
      const p = this.puestos()[index];
      if (p.userId && !this.searchText()[index]) {
        const socio = this.socios().find(s => s.id === p.userId);
        if (socio) this.updateSearch(index, `${socio.apellidos}, ${socio.nombre}`);
      }
    }, 200);
  }

  onSearchChange(index: number, value: string): void {
    this.updateSearch(index, value);
    this.updateDropdown(index, true);
  }

  selectSocio(index: number, socio: User): void {
    this.updatePuesto(index, { userId: socio.id });
    this.updateSearch(index, `${socio.apellidos}, ${socio.nombre}`);
    this.updateDropdown(index, false);
  }

  clearSocio(index: number): void {
    this.updatePuesto(index, { userId: undefined });
    this.updateSearch(index, '');
    this.updateDropdown(index, false);
  }

  onTipoChange(index: number, tipo: 'socio' | 'no_socio'): void {
    this.updatePuesto(index, { tipo }, true);
    this.updateSearch(index, '');
    this.updateDropdown(index, false);
  }

  onNombreExternoChange(index: number, nombre: string): void {
    this.updatePuesto(index, { nombreExterno: nombre });
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.asignados().length === 0) {
      this.error = 'Asigna al menos un tirador';
      return;
    }

    this.loading = true;
    this.error   = '';

    try {
      const entrenamientoId = this.route.snapshot.paramMap.get('id')!;
      const escuadras  = await firstValueFrom(this.escuadraService.getByEntrenamiento(entrenamientoId));
      const escuadraId = await this.escuadraService.createEscuadraEntrenamiento(
        entrenamientoId, escuadras.length + 1
      );

      // 1. Añadir tiradores — puestos vacíos se saltan
      const puestosActuales = this.puestos();
      for (let i = 0; i < puestosActuales.length; i++) {
        const p = puestosActuales[i];
        if (p.tipo === 'socio' && p.userId?.trim()) {
          await this.escuadraService.addTirador(escuadraId, p.userId.trim(), i + 1);
        } else if (p.tipo === 'no_socio') {
          const nombre = p.nombreExterno?.trim() || `No socio ${i + 1}`;
          await this.escuadraService.addNoSocio(escuadraId, nombre, i + 1);
        }
      }

      // 2. Registrar caja solo con los asignados
      const fecha       = new Date().toISOString().split('T')[0];
      const registrador = this.authService.currentUser!.id;
      const sociosMap   = new Map(this.socios().map(s => [s.id, s]));

      const movimientos = this.asignados().map(p => {
        if (p.tipo === 'socio') {
          const socio = sociosMap.get(p.userId!);
          return {
            userId:        p.userId,
            nombreTirador: socio ? `${socio.apellidos}, ${socio.nombre}` : p.userId!,
            esNoSocio:     false,
            importe:       this.tarifaSocio(),
          };
        }
        return {
          userId:        undefined,
          nombreTirador: p.nombreExterno?.trim() || 'No socio',
          esNoSocio:     true,
          importe:       this.tarifaNoSocio(),
        };
      });

      await this.escuadraService.registrarCajaEscuadra(
        escuadraId, entrenamientoId, fecha, registrador, movimientos
      );

      this.router.navigate([
        '/admin/entrenamientos', entrenamientoId,
        'escuadra', escuadraId, 'resultados',
      ]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    const entrenamientoId = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', entrenamientoId]);
  }
}
