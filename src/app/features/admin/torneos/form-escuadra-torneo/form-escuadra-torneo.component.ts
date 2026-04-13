import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { TorneoService } from '../torneo.service';
import { User } from '../../../../core/models/user.model';
import { Torneo } from '../../../../core/models/torneo.model';

@Component({
  selector: 'app-form-escuadra-torneo',
  standalone: true,
  imports: [],
  templateUrl: './form-escuadra-torneo.component.html',
  styleUrl: './form-escuadra-torneo.component.scss',
})
export class FormEscuadraTorneoComponent {
  private escuadraService = inject(EscuadraService);
  private userService     = inject(UserService);
  private authService     = inject(AuthService);
  private torneoService   = inject(TorneoService);
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

  torneo = signal<Torneo | null>(null);
  sociosInscritos = signal<Set<string>>(new Set());

  // Arrays mutables — sin signal, sin @for, para evitar re-render
  userIds: string[] = ['', '', '', '', '', ''];
  tipos: ('socio' | 'no_socio')[] = ['socio', 'socio', 'socio', 'socio', 'socio', 'socio'];
  nombresExternos: string[] = ['', '', '', '', '', ''];

  loading = false;
  error   = '';

  constructor() {
    const torneoId = this.route.snapshot.paramMap.get('id')!;
    firstValueFrom(this.torneoService.getById(torneoId)).then(t => this.torneo.set(t));
    this.torneoService.getSociosInscritos(torneoId).then(s => this.sociosInscritos.set(s));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  get tarifaSocio(): number { return this.torneo()?.precioInscripcionSocio ?? 0; }
  get tarifaNoSocio(): number { return this.torneo()?.precioInscripcionNoSocio ?? 0; }

  sociosDisponibles(index: number): User[] {
    return this.socios().filter(s =>
      !this.userIds.some((id, j) => j !== index && id === s.id)
    );
  }

  yaInscrito(userId: string): boolean {
    return !!userId && this.sociosInscritos().has(userId);
  }

  onSelectSocio(index: number, event: Event): void {
    this.userIds[index] = (event.target as HTMLSelectElement).value;
  }

  onNombreExterno(index: number, event: Event): void {
    this.nombresExternos[index] = (event.target as HTMLInputElement).value;
  }

  onTipoChange(index: number, tipo: 'socio' | 'no_socio'): void {
    this.tipos[index] = tipo;
    this.userIds[index] = '';
    this.nombresExternos[index] = '';
  }

  get asignadosCount(): number {
    let c = 0;
    for (let i = 0; i < 6; i++) {
      if ((this.tipos[i] === 'socio' && this.userIds[i]) || this.tipos[i] === 'no_socio') c++;
    }
    return c;
  }

  get countSocios(): number {
    let c = 0;
    for (let i = 0; i < 6; i++) {
      if (this.tipos[i] === 'socio' && this.userIds[i] && !this.yaInscrito(this.userIds[i])) c++;
    }
    return c;
  }

  get countNoSocios(): number {
    let c = 0;
    for (let i = 0; i < 6; i++) {
      if (this.tipos[i] === 'no_socio') c++;
    }
    return c;
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

      // 1. Añadir tiradores
      for (let i = 0; i < 6; i++) {
        if (this.tipos[i] === 'socio' && this.userIds[i]) {
          await this.escuadraService.addTirador(escuadraId, this.userIds[i], i + 1);
        } else if (this.tipos[i] === 'no_socio') {
          const nombre = this.nombresExternos[i]?.trim() || `No socio ${i + 1}`;
          await this.escuadraService.addNoSocio(escuadraId, nombre, i + 1);
        }
      }

      // 2. Registrar caja
      const fecha       = torneo.fecha;
      const registrador = this.authService.currentUser!.id;
      const sociosMap   = new Map(this.socios().map(s => [s.id, s]));
      const inscritos   = this.sociosInscritos();

      const movimientos: { userId?: string; nombreTirador: string; esNoSocio: boolean; importe: number }[] = [];

      for (let i = 0; i < 6; i++) {
        if (this.tipos[i] === 'socio' && this.userIds[i] && !inscritos.has(this.userIds[i])) {
          const socio = sociosMap.get(this.userIds[i]);
          movimientos.push({
            userId:        this.userIds[i],
            nombreTirador: socio ? `${socio.apellidos}, ${socio.nombre}` : this.userIds[i],
            esNoSocio:     false,
            importe:       this.tarifaSocio,
          });
        } else if (this.tipos[i] === 'no_socio') {
          movimientos.push({
            userId:        undefined,
            nombreTirador: this.nombresExternos[i]?.trim() || 'No socio',
            esNoSocio:     true,
            importe:       this.tarifaNoSocio,
          });
        }
      }

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
