import { Component, inject, signal, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
import { FalloEntrenamiento } from '../../../../core/models/entrenamiento.model';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { EscuadraTirador } from '../../../../core/models/escuadra.model';

interface TiradorSession {
  userId?: string;
  nombreExterno?: string;
  esNoSocio: boolean;
  nombre: string;
  puesto: number;
  platos: boolean[];
}

@Component({
  selector: 'app-registrar-resultado-entrenamiento',
  standalone: true,
  imports: [],
  templateUrl: './registrar-resultado-entrenamiento.component.html',
  styleUrl: './registrar-resultado-entrenamiento.component.scss',
})
export class RegistrarResultadoEntrenamientoComponent {
  private route                = inject(ActivatedRoute);
  private router               = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService      = inject(EscuadraService);
  private userService          = inject(UserService);
  private authService          = inject(AuthService);

  private escuadraId      = this.route.snapshot.paramMap.get('escuadraId')!;
  private entrenamientoId = this.route.snapshot.paramMap.get('entrenamientoId')!;
  private fechaDia        = this.route.snapshot.queryParamMap.get('fecha');

  private socios = toSignal(this.userService.getAll(), { initialValue: [] });
  private tiradores = toSignal(
    this.escuadraService.getTiradoresByEscuadra(this.escuadraId),
    { initialValue: [] as EscuadraTirador[] }
  );

  session        = signal<TiradorSession[]>([]);
  tiradorAbierto = signal<number | null>(null);
  saving         = signal(false);
  error          = signal('');

  readonly indices = Array.from({ length: 25 }, (_, i) => i);

  constructor() {
    // Effect reactivo: se ejecuta cada vez que socios o tiradores cambian.
    // Solo construye la sesión cuando AMBOS tienen datos, evitando mostrar UUIDs.
    effect(() => {
      const socios    = this.socios();
      const tiradores = this.tiradores();

      // Esperar a que ambos estén cargados
      if (tiradores.length === 0 || socios.length === 0) return;
      // No reconstruir si ya está inicializado
      if (this.session().length > 0) return;

      this.session.set(
        tiradores.map((t: EscuadraTirador) => {
          let nombre: string;
          if (t.esNoSocio) {
            nombre = t.nombreExterno?.trim() || 'No socio';
          } else {
            const socio = socios.find(s => s.id === t.userId);
            nombre = socio
              ? `${socio.nombre} ${socio.apellidos}`
              : (t.userId ?? '—');
          }
          return {
            userId:        t.userId,
            nombreExterno: t.nombreExterno,
            esNoSocio:     t.esNoSocio,
            nombre,
            puesto:        t.puesto,
            platos:        Array(25).fill(true),
          };
        })
      );
      this.tiradorAbierto.set(0);
    });
  }

  toggleTirador(idx: number): void {
    this.tiradorAbierto.update(actual => actual === idx ? null : idx);
  }

  platosRotos(t: TiradorSession): number {
    return t.platos.filter(Boolean).length;
  }

  togglePlato(tiradorIdx: number, platoIdx: number): void {
    this.session.update(session =>
      session.map((t, ti) => {
        if (ti !== tiradorIdx) return t;
        const platos = [...t.platos];
        platos[platoIdx] = !platos[platoIdx];
        return { ...t, platos };
      })
    );
  }

  async guardar(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');

      await this.entrenamientoService.upsertResultados(
        this.session().map(t => ({
          escuadraId:    this.escuadraId,
          userId:        t.userId,
          nombreExterno: t.nombreExterno,
          esNoSocio:     t.esNoSocio,
          puesto:        t.puesto,
          platosRotos:   t.platos.filter(Boolean).length,
        })),
        user.id
      );

      const fallos: FalloEntrenamiento[] = [];
      for (const t of this.session()) {
        if (t.esNoSocio || !t.userId) continue;
        for (let i = 0; i < t.platos.length; i++) {
          if (!t.platos[i]) {
            fallos.push({ escuadraId: this.escuadraId, userId: t.userId, numeroPlato: i + 1 });
          }
        }
      }
      const userIds = this.session().filter(t => !t.esNoSocio && !!t.userId).map(t => t.userId!);
      await this.entrenamientoService.upsertFallos(fallos, this.escuadraId, userIds);

      const extras = this.fechaDia ? { queryParams: { fecha: this.fechaDia } } : {};
      this.router.navigate(
        ['/admin/entrenamientos', this.entrenamientoId, 'escuadra', this.escuadraId, 'resumen'],
        extras
      );
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar');
      this.saving.set(false);
    }
  }

  goBack(): void {
    if (this.fechaDia) {
      this.router.navigate(['/admin/entrenamientos/dia', this.fechaDia], { queryParams: { modo: 'editar' } });
    } else {
      this.router.navigate(['/admin/entrenamientos', this.entrenamientoId], { queryParams: { modo: 'editar' } });
    }
  }
}
