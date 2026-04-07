import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
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

  private socios = toSignal(this.userService.getAll(), { initialValue: [] });
  private tiradores = toSignal(
    this.escuadraService.getTiradoresByEscuadra(this.escuadraId),
    { initialValue: [] }
  );

  session = signal<TiradorSession[]>([]);
  tiradoreActual = signal(0);
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
            platos: Array(25).fill(true),  // true = roto, false = fallo
          };
        })
      );
    };

    init();
    if (this.session().length === 0) {
      const interval = setInterval(() => {
        init();
        if (this.session().length > 0) clearInterval(interval);
      }, 200);
    }
  }

  tirador(): TiradorSession | null {
    return this.session()[this.tiradoreActual()] ?? null;
  }

  platosRotosActual(): number {
    return this.tirador()?.platos.filter(Boolean).length ?? 0;
  }

  fallosActual(): number {
    return this.tirador()?.platos.filter(v => !v).length ?? 0;
  }

  esUltimo(): boolean {
    return this.tiradoreActual() === this.session().length - 1;
  }

  togglePlato(i: number): void {
    this.session.update(session => {
      const idx = this.tiradoreActual();
      return session.map((t, ti) => {
        if (ti !== idx) return t;
        const platos = [...t.platos];
        platos[i] = !platos[i];
        return { ...t, platos };
      });
    });
  }

  siguiente(): void {
    if (this.esUltimo()) {
      this.guardar();
    } else {
      this.tiradoreActual.update(i => i + 1);
    }
  }

  anterior(): void {
    if (this.tiradoreActual() > 0) {
      this.tiradoreActual.update(i => i - 1);
    }
  }

  async guardar(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');
      await this.entrenamientoService.upsertResultados(
        this.session().map(t => ({
          escuadraId: this.escuadraId,
          userId: t.userId,
          puesto: t.puesto,
          platosRotos: t.platos.filter(Boolean).length,
        })),
        user.id
      );
      this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar');
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
  }
}
