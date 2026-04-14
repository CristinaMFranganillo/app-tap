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

type Fase = 'intro' | 'espera' | 'volando' | 'feedback' | 'resultado';

interface RondaResultado {
  acierto: boolean;
  ms: number | null;
}

const TOTAL_RONDAS = 10;
const TIMEOUT_MS = 1500;
const PAUSA_ENTRE_RONDAS = 600;
const FEEDBACK_MS = 300;

@Component({
  selector: 'app-lateralidad',
  standalone: true,
  templateUrl: './lateralidad.component.html',
  styleUrl: './lateralidad.component.scss',
})
export class LateralidadComponent implements OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private juegosService = inject(JuegosService);

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private timestamp = 0;
  private respondido = false;
  private resultados: RondaResultado[] = [];

  readonly TOTAL_RONDAS = TOTAL_RONDAS;

  // Señales de estado
  fase = signal<Fase>('intro');
  rondaActual = signal(0);
  direccion = signal<'izq' | 'dcha'>('izq');
  feedbackOk = signal<boolean | null>(null);
  resultadosFinal = signal<RondaResultado[]>([]);
  guardado = signal(false);
  posicionClub = signal<number | null>(null);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  // Computadas
  aciertos = computed(() =>
    this.resultadosFinal().filter(r => r.acierto).length
  );

  fallos = computed(() =>
    this.resultadosFinal().filter(r => !r.acierto).length
  );

  precision = computed(() =>
    Math.round((this.aciertos() / TOTAL_RONDAS) * 100)
  );

  mediaMs = computed(() => {
    const validos = this.resultadosFinal()
      .filter(r => r.acierto && r.ms !== null)
      .map(r => r.ms as number);
    if (validos.length === 0) return null;
    return Math.round(validos.reduce((a, b) => a + b, 0) / validos.length);
  });

  mejorMs = computed(() => {
    const validos = this.resultadosFinal()
      .filter(r => r.acierto && r.ms !== null)
      .map(r => r.ms as number);
    if (validos.length === 0) return null;
    return Math.min(...validos);
  });

  // ────────────────────────────────────────────
  // Flujo del juego
  // ────────────────────────────────────────────

  empezar(): void {
    this.rondaActual.set(0);
    this.resultados = [];
    this.resultadosFinal.set([]);
    this.guardado.set(false);
    this.posicionClub.set(null);
    this.feedbackOk.set(null);
    this.iniciarRonda();
  }

  private iniciarRonda(): void {
    this.respondido = false;
    this.fase.set('espera');

    const t = setTimeout(() => {
      const dir: 'izq' | 'dcha' = Math.random() < 0.5 ? 'izq' : 'dcha';
      this.direccion.set(dir);
      this.timestamp = performance.now();
      this.fase.set('volando');

      // Timeout automático si el usuario no pulsa
      const timeout = setTimeout(() => {
        if (!this.respondido) {
          this.registrarRespuesta(false, null);
        }
      }, TIMEOUT_MS);
      this.timeouts.push(timeout);
    }, PAUSA_ENTRE_RONDAS);

    this.timeouts.push(t);
  }

  responder(lado: 'izq' | 'dcha'): void {
    if (this.fase() !== 'volando' || this.respondido) return;
    this.respondido = true;

    const ms = Math.round(performance.now() - this.timestamp);
    const acierto = lado === this.direccion();
    this.registrarRespuesta(acierto, ms);
  }

  private registrarRespuesta(acierto: boolean, ms: number | null): void {
    this.respondido = true;
    this.resultados.push({ acierto, ms });
    this.rondaActual.update(n => n + 1);

    this.feedbackOk.set(acierto);
    this.fase.set('feedback');

    const t = setTimeout(() => {
      this.feedbackOk.set(null);
      if (this.rondaActual() >= TOTAL_RONDAS) {
        this.mostrarResultado();
      } else {
        this.iniciarRonda();
      }
    }, FEEDBACK_MS);
    this.timeouts.push(t);
  }

  private mostrarResultado(): void {
    this.resultadosFinal.set([...this.resultados]);
    this.fase.set('resultado');
    this.guardarYRanking();
  }

  private async guardarYRanking(): Promise<void> {
    const userId = this.user()?.id;
    const media = this.mediaMs();
    const totalAciertos = this.aciertos();
    if (!userId) return;

    try {
      await this.juegosService.guardarPartidaAsync(
        userId,
        'lateralidad',
        media ?? 9999,
        totalAciertos,
        TOTAL_RONDAS
      );
      this.guardado.set(true);

      this.juegosService.getRanking('lateralidad', 200).subscribe(ranking => {
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
