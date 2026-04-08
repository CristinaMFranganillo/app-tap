import { Component, inject } from '@angular/core';
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

  puestos: PuestoVM[] = Array.from({ length: 6 }, () => ({ tipo: 'socio' as const }));

  loading = false;
  error   = '';

  // ── Helpers ──────────────────────────────────────────────────────────────

  get tarifaSocio(): number {
    return this.tarifas().find(t => t.tipo === 'socio')?.importe ?? 6;
  }

  get tarifaNoSocio(): number {
    return this.tarifas().find(t => t.tipo === 'no_socio')?.importe ?? 7;
  }

  get asignados(): PuestoVM[] {
    return this.puestos.filter(p =>
      (p.tipo === 'socio'    && !!p.userId?.trim()) ||
      (p.tipo === 'no_socio' && !!p.nombreExterno?.trim())
    );
  }

  get totalEscuadra(): number {
    return this.asignados.reduce((sum, p) =>
      sum + (p.tipo === 'socio' ? this.tarifaSocio : this.tarifaNoSocio), 0
    );
  }

  get countSocios(): number {
    return this.asignados.filter(p => p.tipo === 'socio').length;
  }

  get countNoSocios(): number {
    return this.asignados.filter(p => p.tipo === 'no_socio').length;
  }

  sociosDisponibles(index: number): User[] {
    const ocupados = this.puestos
      .filter((p, j) => j !== index && p.tipo === 'socio' && !!p.userId)
      .map(p => p.userId);
    return this.socios().filter(s => !ocupados.includes(s.id));
  }

  onTipoChange(index: number, tipo: 'socio' | 'no_socio'): void {
    this.puestos[index] = { tipo };
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.asignados.length === 0) {
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
      for (let i = 0; i < this.puestos.length; i++) {
        const p = this.puestos[i];
        if (p.tipo === 'socio' && p.userId?.trim()) {
          await this.escuadraService.addTirador(escuadraId, p.userId.trim(), i + 1);
        } else if (p.tipo === 'no_socio' && p.nombreExterno?.trim()) {
          await this.escuadraService.addNoSocio(escuadraId, p.nombreExterno.trim(), i + 1);
        }
      }

      // 2. Registrar caja solo con los asignados
      const fecha       = new Date().toISOString().split('T')[0];
      const registrador = this.authService.currentUser!.id;
      const sociosMap   = new Map(this.socios().map(s => [s.id, s]));

      const movimientos = this.asignados.map(p => {
        if (p.tipo === 'socio') {
          const socio = sociosMap.get(p.userId!);
          return {
            userId:        p.userId,
            nombreTirador: socio ? `${socio.apellidos}, ${socio.nombre}` : p.userId!,
            esNoSocio:     false,
            importe:       this.tarifaSocio,
          };
        }
        return {
          userId:        undefined,
          nombreTirador: p.nombreExterno!.trim(),
          esNoSocio:     true,
          importe:       this.tarifaNoSocio,
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
