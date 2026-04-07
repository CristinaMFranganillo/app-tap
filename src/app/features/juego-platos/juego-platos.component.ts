import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

interface Plato {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  roto: boolean;
  rotoFrame: number;
}

const TOTAL_PLATOS = 25;
const GRAVITY = 0.08;
const BASE_SPEED = 4.5;

@Component({
  selector: 'app-juego-platos',
  standalone: true,
  templateUrl: './juego-platos.component.html',
  styleUrl: './juego-platos.component.scss',
})
export class JuegoPlatosComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  fase = signal<'ready' | 'playing' | 'end'>('ready');
  platosRotos = signal(0);
  platosLanzados = signal(0);
  platosErrados = signal(0);

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animId = 0;
  private frame = 0;
  private platos: Plato[] = [];
  private lanzamientoTimer = 0;
  private intervalLanzamiento = 90;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
  }

  @HostListener('window:resize')
  resize(): void {
    this.canvas.width  = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }

  start(): void {
    this.platos = [];
    this.frame = 0;
    this.lanzamientoTimer = 0;
    this.intervalLanzamiento = 90;
    this.platosRotos.set(0);
    this.platosLanzados.set(0);
    this.platosErrados.set(0);
    this.fase.set('playing');
    this.loop();
  }

  volver(): void {
    cancelAnimationFrame(this.animId);
    this.router.navigate(['/']);
  }

  private loop(): void {
    this.animId = requestAnimationFrame(() => this.loop());
    this.frame++;
    this.update();
    this.draw();
  }

  private update(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (
      this.platosLanzados() < TOTAL_PLATOS &&
      this.frame - this.lanzamientoTimer >= this.intervalLanzamiento
    ) {
      this.lanzarPlato(W, H);
      this.lanzamientoTimer = this.frame;
      this.intervalLanzamiento = Math.max(45, this.intervalLanzamiento - 3);
    }

    for (const p of this.platos) {
      if (p.roto) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAVITY;

      if (p.y > H + 40 || p.x < -60 || p.x > W + 60) {
        p.roto = true;
        this.platosErrados.update(v => v + 1);
        this.checkFin();
      }
    }
  }

  private lanzarPlato(W: number, H: number): void {
    const desdeIzquierda = Math.random() < 0.5;
    const speed = BASE_SPEED + Math.random() * 1.5;
    const angle = desdeIzquierda
      ? (Math.PI / 180) * (-(40 + Math.random() * 30))
      : (Math.PI / 180) * (-(140 + Math.random() * 30));

    this.platos.push({
      x:         desdeIzquierda ? -10 : W + 10,
      y:         H * (0.65 + Math.random() * 0.2),
      vx:        Math.cos(angle) * speed,
      vy:        Math.sin(angle) * speed,
      r:         18,
      roto:      false,
      rotoFrame: 0,
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
        this.fase.set('end');
      }, 800);
    }
  }

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
        minDist = dist;
        closest = p;
      }
    }

    if (closest) {
      closest.roto = true;
      closest.rotoFrame = this.frame;
      this.platosRotos.update(v => v + 1);
      this.checkFin();
    }
  }

  private draw(): void {
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const ctx = this.ctx;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0d1520');
    sky.addColorStop(1, '#1a2e40');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#111111';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, H - 30, W, 4);

    for (const p of this.platos) {
      if (!p.roto) {
        this.drawPlato(ctx, p);
      } else if (p.rotoFrame > 0) {
        const age = this.frame - p.rotoFrame;
        if (age < 20) this.drawExplosion(ctx, p, age);
      }
    }

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

  private drawPlato(ctx: CanvasRenderingContext2D, p: Plato): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = 'rgba(245,224,0,0.2)';
    ctx.shadowBlur  = 10;

    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = '#BF4F0A';
    ctx.fill();
    ctx.strokeStyle = '#8B3506';
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, -p.r * 0.18, p.r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#D96010';
    ctx.fill();

    ctx.restore();
  }

  private drawExplosion(ctx: CanvasRenderingContext2D, p: Plato, age: number): void {
    const alpha = Math.max(0, 1 - age / 20);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);

    ctx.beginPath();
    ctx.arc(0, 0, p.r * (1 + age * 0.18), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(245,224,0,${0.55 * alpha})`;
    ctx.fill();

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + age * 0.25;
      const dist  = age * 2.5;
      ctx.save();
      ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist - age * 0.6);
      ctx.rotate(angle + age * 0.4);
      ctx.fillStyle = '#BF4F0A';
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }

    ctx.restore();
  }

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
}
