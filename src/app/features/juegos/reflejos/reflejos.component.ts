import {
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { JuegosService } from '../juegos.service';

type Fase = 'intro' | 'espera' | 'plato' | 'prematuro' | 'resultado';

const TOTAL_RONDAS = 5;
const MIN_ESPERA = 1000;
const MAX_ESPERA = 4000;

@Component({
  selector: 'app-reflejos',
  standalone: true,
  templateUrl: './reflejos.component.html',
  styleUrl: './reflejos.component.scss',
})
export class ReflejosComponent implements OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private juegosService = inject(JuegosService);

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private timestamp = 0;

  readonly TOTAL_RONDAS = TOTAL_RONDAS;

  // Señales de estado
  fase = signal<Fase>('intro');
  rondaActual = signal(0);
  tiempos = signal<(number | null)[]>([]);
  guardado = signal(false);
  posicionClub = signal<number | null>(null);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  // Computadas
  mediaMs = computed(() => {
    const validos = this.tiempos().filter((t): t is number => t !== null);
    if (validos.length === 0) return 0;
    return Math.round(validos.reduce((a, b) => a + b, 0) / validos.length);
  });

  mejorMs = computed(() => {
    const validos = this.tiempos().filter((t): t is number => t !== null);
    if (validos.length === 0) return 0;
    return Math.min(...validos);
  });

  peorMs = computed(() => {
    const validos = this.tiempos().filter((t): t is number => t !== null);
    if (validos.length === 0) return 0;
    return Math.max(...validos);
  });

  rondasNulas = computed(() =>
    this.tiempos().filter(t => t === null).length
  );

  // ────────────────────────────────────────────
  // Flujo del juego
  // ────────────────────────────────────────────

  empezar(): void {
    this.rondaActual.set(0);
    this.tiempos.set([]);
    this.guardado.set(false);
    this.posicionClub.set(null);
    this.iniciarRonda();
  }

  private iniciarRonda(): void {
    this.fase.set('espera');
    const delay =
      MIN_ESPERA + Math.random() * (MAX_ESPERA - MIN_ESPERA);

    const t = setTimeout(() => {
      this.timestamp = performance.now();
      this.fase.set('plato');
    }, delay);

    this.timeouts.push(t);
  }

  onClickZona(): void {
    if (this.fase() === 'espera') {
      // Click prematuro
      this.limpiarTimeouts();
      this.registrarTiempo(null);
      this.fase.set('prematuro');
      const t = setTimeout(() => this.avanzar(), 1000);
      this.timeouts.push(t);
    } else if (this.fase() === 'plato') {
      const ms = Math.round(performance.now() - this.timestamp);
      this.registrarTiempo(ms);
      this.avanzar();
    }
  }

  private registrarTiempo(ms: number | null): void {
    this.tiempos.update(arr => [...arr, ms]);
    this.rondaActual.update(n => n + 1);
  }

  private avanzar(): void {
    if (this.rondaActual() >= TOTAL_RONDAS) {
      this.mostrarResultado();
    } else {
      this.iniciarRonda();
    }
  }

  private mostrarResultado(): void {
    this.fase.set('resultado');
    this.guardarYRanking();
  }

  private async guardarYRanking(): Promise<void> {
    const userId = this.user()?.id;
    const media = this.mediaMs();
    if (!userId || media === 0) return;

    try {
      await this.juegosService.guardarPartidaAsync(
        userId,
        'reflejos',
        media,
        null,
        TOTAL_RONDAS
      );
      this.guardado.set(true);

      this.juegosService.getRanking('reflejos', 200).subscribe(ranking => {
        const idx = ranking.findIndex(r => r.userId === userId);
        this.posicionClub.set(idx >= 0 ? idx + 1 : null);
      });
    } catch {
      // Silencioso: el usuario igual ve su resultado
    }
  }

  jugarDeNuevo(): void {
    this.empezar();
  }

  volver(): void {
    this.router.navigate(['/juegos']);
  }

  // ────────────────────────────────────────────
  // Cleanup
  // ────────────────────────────────────────────

  private limpiarTimeouts(): void {
    this.timeouts.forEach(t => clearTimeout(t));
    this.timeouts = [];
  }

  ngOnDestroy(): void {
    this.limpiarTimeouts();
  }
}
