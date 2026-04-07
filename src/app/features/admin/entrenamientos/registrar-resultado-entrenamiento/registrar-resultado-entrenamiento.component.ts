import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
import { FalloEntrenamiento } from '../../../../core/models/entrenamiento.model';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';

interface TiradorSession {
  userId: string;
  nombre: string;
  puesto: number;
  platos: boolean[];   // 25 elementos, true = roto
}

@Component({
  selector: 'app-registrar-resultado-entrenamiento',
  standalone: true,
  imports: [],
  templateUrl: './registrar-resultado-entrenamiento.component.html',
  styleUrl: './registrar-resultado-entrenamiento.component.scss',
})
export class RegistrarResultadoEntrenamientoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private authService = inject(AuthService);

  private escuadraId = this.route.snapshot.paramMap.get('escuadraId')!;
  private entrenamientoId = this.route.snapshot.paramMap.get('entrenamientoId')!;
  private fechaDia = this.route.snapshot.queryParamMap.get('fecha');

  private socios = toSignal(this.userService.getAll(), { initialValue: [] });
  private tiradores = toSignal(
    this.escuadraService.getTiradoresByEscuadra(this.escuadraId),
    { initialValue: [] }
  );

  session = signal<TiradorSession[]>([]);
  tiradorAbierto = signal<number | null>(null);  // índice del tirador expandido
  saving = signal(false);
  error = signal('');

  readonly indices = Array.from({ length: 25 }, (_, i) => i);

  ngOnInit(): void {
    const init = () => {
      const socios = this.socios();
      const tiradores = this.tiradores();
      if (tiradores.length === 0) return;
      this.session.set(
        tiradores.map(t => {
          const socio = socios.find(s => s.id === t.userId);
          return {
            userId: t.userId,
            nombre: socio ? `${socio.nombre} ${socio.apellidos}` : t.userId,
            puesto: t.puesto,
            platos: Array(25).fill(true),
          };
        })
      );
      // Abrir el primero por defecto
      this.tiradorAbierto.set(0);
    };

    init();
    if (this.session().length === 0) {
      const interval = setInterval(() => {
        init();
        if (this.session().length > 0) clearInterval(interval);
      }, 200);
    }
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

      // 1. Guardar totales (igual que antes)
      await this.entrenamientoService.upsertResultados(
        this.session().map(t => ({
          escuadraId: this.escuadraId,
          userId: t.userId,
          puesto: t.puesto,
          platosRotos: t.platos.filter(Boolean).length,
        })),
        user.id
      );

      // 2. Guardar fallos individuales (nuevo)
      const fallos: FalloEntrenamiento[] = [];
      for (const t of this.session()) {
        for (let i = 0; i < t.platos.length; i++) {
          if (!t.platos[i]) {
            fallos.push({
              escuadraId: this.escuadraId,
              userId: t.userId,
              numeroPlato: i + 1,
            });
          }
        }
      }
      const userIds = this.session().map(t => t.userId);
      await this.entrenamientoService.upsertFallos(fallos, this.escuadraId, userIds);

      const extras = this.fechaDia ? { queryParams: { fecha: this.fechaDia } } : {};
      this.router.navigate([
        '/admin/entrenamientos', this.entrenamientoId,
        'escuadra', this.escuadraId, 'resumen',
      ], extras);
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
