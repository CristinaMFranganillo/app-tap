import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  signal,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { supabase } from '../../core/supabase/supabase.client';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Plato {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;       // ángulo actual (rotación visual)
  rotSpeed: number;  // velocidad de giro
  roto: boolean;
  rotoFrame: number;
  trail: { x: number; y: number }[]; // estela
}

interface MissMarker {
  x: number;
  y: number;
  frame: number; // frame en que apareció
}

interface ScoreEntry {
  rotos: number;
  precision: number;
  fecha: string;
}

interface RankingGlobalEntry {
  nombre: string;
  apellidos: string;
  rotos: number;
  precision: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TOTAL_PLATOS    = 25;
const GRAVITY         = 0.08;
const BASE_SPEED      = 4.5;
const TRAIL_LENGTH    = 5;
const LS_KEY          = 'apptap_juego_record';
const LS_RANKING_KEY  = 'apptap_juego_ranking';
const MAX_RANKING     = 5;

@Component({
  selector: 'app-juego-platos',
  standalone: true,
  templateUrl: './juego-platos.component.html',
  styleUrl:    './juego-platos.component.scss',
})
export class JuegoPlatosComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // ── Señales de estado ─────────────────────────────────────────────
  fase           = signal<'ready' | 'countdown' | 'playing' | 'end'>('ready');
  platosRotos    = signal(0);
  platosLanzados = signal(0);
  platosErrados  = signal(0);
  racha          = signal(0);        // platos consecutivos sin errar
  maxRacha       = signal(0);
  cuentaAtras    = signal(3);
  flashFrame     = signal(0);        // frame del último acierto (flash pantalla)
  esBatidoRecord = signal(false);
  contadorFin    = signal(0);        // para animación de conteo en resultado

  // Récord y ranking en localStorage
  record        = signal<ScoreEntry | null>(this.loadRecord());
  ranking       = signal<ScoreEntry[]>(this.loadRanking());
  rankingGlobal = signal<RankingGlobalEntry[]>([]);

  // ── Canvas / loop ─────────────────────────────────────────────────
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animId        = 0;
  private frame         = 0;
  private platos: Plato[]       = [];
  private missMarkers: MissMarker[] = [];
  private lanzamientoTimer      = 0;
  private intervalLanzamiento   = 90;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private countIntervalId: ReturnType<typeof setInterval> | null = null;

  // Nubes del fondo (posición fija generada una vez)
  private clouds: { x: number; y: number; r: number; alpha: number }[] = [];

  private authService = inject(AuthService);
  constructor(private router: Router) {}

  // ── Lifecycle ─────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx    = this.canvas.getContext('2d')!;
    this.resize();
    this.generateClouds();
    this.drawStatic(); // dibuja el fondo en pantalla ready
    this.cargarRankingGlobal();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
    if (this.countdownTimer)  clearTimeout(this.countdownTimer);
    if (this.countIntervalId) clearInterval(this.countIntervalId);
  }

  @HostListener('window:resize')
  resize(): void {
    this.canvas.width  = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    this.generateClouds();
  }

  // ── Iniciar: cuenta atrás ─────────────────────────────────────────

  iniciarCuentaAtras(): void {
    this.fase.set('countdown');
    this.cuentaAtras.set(3);

    const tick = () => {
      const v = this.cuentaAtras() - 1;
      if (v <= 0) {
        this.cuentaAtras.set(0);
        this.startGame();
      } else {
        this.cuentaAtras.set(v);
        this.countdownTimer = setTimeout(tick, 1000);
      }
    };
    this.countdownTimer = setTimeout(tick, 1000);
  }

  private startGame(): void {
    this.platos            = [];
    this.missMarkers       = [];
    this.frame             = 0;
    this.lanzamientoTimer  = 0;
    this.intervalLanzamiento = 90;
    this.platosRotos.set(0);
    this.platosLanzados.set(0);
    this.platosErrados.set(0);
    this.racha.set(0);
    this.maxRacha.set(0);
    this.esBatidoRecord.set(false);
    this.flashFrame.set(0);
    this.fase.set('playing');
    this.loop();
  }

  volver(): void {
    cancelAnimationFrame(this.animId);
    if (this.countdownTimer)  clearTimeout(this.countdownTimer);
    if (this.countIntervalId) clearInterval(this.countIntervalId);
    this.router.navigate(['/']);
  }

  // ── Game loop ─────────────────────────────────────────────────────

  private loop(): void {
    this.animId = requestAnimationFrame(() => this.loop());
    this.frame++;
    this.update();
    this.draw();
  }

  private update(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Lanzar platos
    if (
      this.platosLanzados() < TOTAL_PLATOS &&
      this.frame - this.lanzamientoTimer >= this.intervalLanzamiento
    ) {
      // A partir del plato 14 hay posibilidad de lanzar doble
      const doble = this.platosLanzados() >= 14 && Math.random() < 0.35;
      this.lanzarPlato(W, H);
      if (doble && this.platosLanzados() < TOTAL_PLATOS) {
        this.lanzarPlato(W, H, true); // lanzamiento opuesto
      }
      this.lanzamientoTimer      = this.frame;
      this.intervalLanzamiento   = Math.max(45, this.intervalLanzamiento - 3);
    }

    // Mover platos y actualizar trail
    for (const p of this.platos) {
      if (p.roto) continue;

      // Trail: guardar posición anterior
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > TRAIL_LENGTH) p.trail.shift();

      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += GRAVITY;
      p.rot += p.rotSpeed;

      // Plato fuera de pantalla → errado
      if (p.y > H + 40 || p.x < -80 || p.x > W + 80) {
        p.roto = true;
        // Marker de fallo en el borde donde salió
        this.missMarkers.push({
          x: Math.max(10, Math.min(W - 10, p.x)),
          y: Math.max(10, Math.min(H - 10, p.y)),
          frame: this.frame,
        });
        this.racha.set(0);
        this.platosErrados.update(v => v + 1);
        this.checkFin();
      }
    }

    // Limpiar miss markers viejos (> 40 frames)
    this.missMarkers = this.missMarkers.filter(m => this.frame - m.frame < 40);
  }

  private lanzarPlato(W: number, H: number, forzarDerecha = false): void {
    const desdeIzquierda = forzarDerecha ? false : Math.random() < 0.5;
    const speed  = BASE_SPEED + Math.random() * 1.5;
    const angle  = desdeIzquierda
      ? (Math.PI / 180) * (-(40 + Math.random() * 30))
      : (Math.PI / 180) * (-(140 + Math.random() * 30));
    const rotDir = desdeIzquierda ? 1 : -1;

    this.platos.push({
      x:         desdeIzquierda ? -10 : W + 10,
      y:         H * (0.65 + Math.random() * 0.2),
      vx:        Math.cos(angle) * speed,
      vy:        Math.sin(angle) * speed,
      r:         18,
      rot:       0,
      rotSpeed:  rotDir * (0.04 + Math.random() * 0.03),
      roto:      false,
      rotoFrame: 0,
      trail:     [],
    });

    this.platosLanzados.update(v => v + 1);
  }

  private checkFin(): void {
    const lanzados = this.platosLanzados();
    const rotos    = this.platosRotos();
    const errados  = this.platosErrados();

    if (lanzados >= TOTAL_PLATOS && rotos + errados >= TOTAL_PLATOS) {
      setTimeout(() => {
        cancelAnimationFrame(this.animId);
        this.saveResult();
        this.animarContador();
        this.fase.set('end');
      }, 900);
    }
  }

  // ── Click / Tap ───────────────────────────────────────────────────

  onCanvasClick(event: MouseEvent | TouchEvent): void {
    if (this.fase() !== 'playing') return;

    const rect = this.canvas.getBoundingClientRect();
    let cx: number, cy: number;

    if (event instanceof TouchEvent) {
      event.preventDefault();
      cx = event.changedTouches[0].clientX;
      cy = event.changedTouches[0].clientY;
    } else {
      cx = (event as MouseEvent).clientX;
      cy = (event as MouseEvent).clientY;
    }

    const x = cx - rect.left;
    const y = cy - rect.top;

    let closest: Plato | null = null;
    let minDist = Infinity;

    for (const p of this.platos) {
      if (p.roto) continue;
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < p.r * 2.8 && dist < minDist) {
        minDist  = dist;
        closest  = p;
      }
    }

    if (closest) {
      closest.roto      = true;
      closest.rotoFrame = this.frame;
      this.flashFrame.set(this.frame); // activar flash de pantalla
      const nueva = this.racha() + 1;
      this.racha.set(nueva);
      if (nueva > this.maxRacha()) this.maxRacha.set(nueva);
      this.platosRotos.update(v => v + 1);
      this.checkFin();
    }
    // Fallo de puntería (toque en vacío) → no penaliza, solo feedback visual
  }

  // ── Guardar récord y ranking ──────────────────────────────────────

  private async cargarRankingGlobal(): Promise<void> {
    const { data } = await supabase
      .from('juego_resultados')
      .select('rotos, precision, profiles(nombre, apellidos)')
      .order('rotos', { ascending: false })
      .order('precision', { ascending: false })
      .limit(10);

    if (!data) return;

    const entries: RankingGlobalEntry[] = data.map((r: Record<string, unknown>) => {
      const p = r['profiles'] as Record<string, string> | null;
      return {
        nombre:    p?.['nombre']    ?? 'Socio',
        apellidos: p?.['apellidos'] ?? '',
        rotos:     r['rotos'] as number,
        precision: r['precision'] as number,
      };
    });

    this.rankingGlobal.set(entries);
  }

  private saveResult(): void {
    const entry: ScoreEntry = {
      rotos:     this.platosRotos(),
      precision: this.precision,
      fecha:     new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    };

    // Récord
    const rec = this.record();
    if (!rec || entry.rotos > rec.rotos) {
      this.record.set(entry);
      this.esBatidoRecord.set(true);
      try { localStorage.setItem(LS_KEY, JSON.stringify(entry)); } catch (_) {}
    }

    // Ranking local
    const list = [...this.ranking(), entry]
      .sort((a, b) => b.rotos - a.rotos)
      .slice(0, MAX_RANKING);
    this.ranking.set(list);
    try { localStorage.setItem(LS_RANKING_KEY, JSON.stringify(list)); } catch (_) {}

    // Guardar en Supabase
    this.authService.currentUser$.subscribe(user => {
      if (!user) return;
      supabase.from('juego_resultados').insert({
        user_id:   user.id,
        rotos:     this.platosRotos(),
        errados:   this.platosErrados(),
        precision: this.precision,
        max_racha: this.maxRacha(),
      }).then(({ error }) => {
        if (error) console.warn('No se pudo guardar resultado en Supabase:', error.message);
        else this.cargarRankingGlobal();
      });
    }).unsubscribe();
  }

  private loadRecord(): ScoreEntry | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private loadRanking(): ScoreEntry[] {
    try {
      const raw = localStorage.getItem(LS_RANKING_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  // Animación de conteo 0 → resultado final en pantalla de fin
  private animarContador(): void {
    this.contadorFin.set(0);
    const target = this.platosRotos();
    let current  = 0;
    this.countIntervalId = setInterval(() => {
      current++;
      this.contadorFin.set(current);
      if (current >= target) {
        if (this.countIntervalId) clearInterval(this.countIntervalId);
      }
    }, 60);
  }

  // ── Render ────────────────────────────────────────────────────────

  private generateClouds(): void {
    const W = this.canvas.width  || 400;
    const H = this.canvas.height || 700;
    this.clouds = Array.from({ length: 6 }, () => ({
      x:     Math.random() * W,
      y:     H * 0.05 + Math.random() * H * 0.3,
      r:     30 + Math.random() * 50,
      alpha: 0.04 + Math.random() * 0.06,
    }));
  }

  private drawStatic(): void {
    if (!this.ctx) return;
    const W = this.canvas.width  || this.canvas.offsetWidth;
    const H = this.canvas.height || this.canvas.offsetHeight;
    this.drawBackground(this.ctx, W, H);
  }

  private draw(): void {
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const ctx = this.ctx;

    this.drawBackground(ctx, W, H);

    // Flash de acierto (borde amarillo en toda la pantalla)
    const flashAge = this.frame - this.flashFrame();
    if (flashAge < 8 && this.flashFrame() > 0) {
      const alpha = (1 - flashAge / 8) * 0.18;
      ctx.save();
      ctx.strokeStyle = `rgba(245,224,0,${alpha})`;
      ctx.lineWidth   = 18;
      ctx.strokeRect(0, 0, W, H);
      ctx.restore();
    }

    // Miss markers (X roja)
    for (const m of this.missMarkers) {
      const age   = this.frame - m.frame;
      const alpha = Math.max(0, 1 - age / 40);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth   = 2.5;
      ctx.translate(m.x, m.y);
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8);   ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -8);  ctx.lineTo(-8, 8);  ctx.stroke();
      ctx.restore();
    }

    // Platos
    for (const p of this.platos) {
      if (!p.roto) {
        this.drawTrail(ctx, p);
        this.drawPlato(ctx, p);
      } else if (p.rotoFrame > 0) {
        const age = this.frame - p.rotoFrame;
        if (age < 22) this.drawExplosion(ctx, p, age);
      }
    }

    // Hint inicial parpadeante
    if (this.platosRotos() === 0 && this.platosLanzados() < 3) {
      const alpha = 0.35 + 0.3 * Math.sin(this.frame * 0.1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = '#F5E000';
      ctx.font        = 'bold 12px Montserrat, system-ui, sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillText('¡TAP para disparar!', W / 2, H * 0.42);
      ctx.restore();
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // Degradado cielo
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,   '#0a1020');
    sky.addColorStop(0.6, '#1a2e40');
    sky.addColorStop(1,   '#162030');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Nubes suaves
    for (const c of this.clouds) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle   = '#ffffff';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Horizonte: silueta de colina
    ctx.save();
    ctx.fillStyle = '#0d1a10';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.78);
    ctx.bezierCurveTo(W * 0.2, H * 0.68, W * 0.4, H * 0.82, W * 0.6, H * 0.75);
    ctx.bezierCurveTo(W * 0.8, H * 0.68, W * 0.9, H * 0.80, W, H * 0.76);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Suelo
    ctx.fillStyle = '#0f1a12';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, H - 30, W, 4);
  }

  private drawTrail(ctx: CanvasRenderingContext2D, p: Plato): void {
    for (let i = 0; i < p.trail.length; i++) {
      const t     = p.trail[i];
      const alpha = ((i + 1) / p.trail.length) * 0.25;
      const r     = p.r * ((i + 1) / p.trail.length) * 0.7;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#BF4F0A';
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPlato(ctx: CanvasRenderingContext2D, p: Plato): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot); // rotación en vuelo

    ctx.shadowColor = 'rgba(245,224,0,0.15)';
    ctx.shadowBlur  = 10;

    // Cuerpo
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle   = '#BF4F0A';
    ctx.fill();
    ctx.strokeStyle = '#8B3506';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Línea de acanalado (da sensación de disco real)
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(100,30,5,0.5)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // Cúpula central
    ctx.beginPath();
    ctx.arc(0, -p.r * 0.18, p.r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#D96010';
    ctx.fill();

    ctx.restore();
  }

  private drawExplosion(ctx: CanvasRenderingContext2D, p: Plato, age: number): void {
    const alpha = Math.max(0, 1 - age / 22);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);

    // Flash central
    ctx.beginPath();
    ctx.arc(0, 0, p.r * (1 + age * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(245,224,0,${0.6 * alpha})`;
    ctx.fill();

    // Fragmentos volando
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2 + age * 0.2;
      const dist  = age * 2.8;
      ctx.save();
      ctx.translate(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist - age * 0.7,
      );
      ctx.rotate(angle + age * 0.5);
      ctx.fillStyle = i % 2 === 0 ? '#BF4F0A' : '#D96010';
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── Helpers template ──────────────────────────────────────────────

  get precision(): number {
    const l = this.platosLanzados();
    return l === 0 ? 0 : Math.round((this.platosRotos() / l) * 100);
  }

  get mensajeFinal(): string {
    const r = this.platosRotos();
    if (r === 25) return '¡Plato completo! 🏆';
    if (r >= 22)  return '¡Excelente tirada! 🎯';
    if (r >= 18)  return '¡Muy buena serie!';
    if (r >= 12)  return 'Buen intento';
    return 'Sigue practicando 💪';
  }

  get rachaLabel(): string {
    const r = this.racha();
    if (r >= 8)  return `🔥🔥 x${r}`;
    if (r >= 4)  return `🔥 x${r}`;
    return '';
  }
}
