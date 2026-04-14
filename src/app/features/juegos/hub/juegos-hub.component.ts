import { Component, inject, signal, computed } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, EMPTY } from 'rxjs';
import { SlicePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { JuegosService, RankingJuego } from '../juegos.service';

interface JuegoCard {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  fondoIcono: string;
  colorMarca: string;
  ruta: string;
  tipoJuego: string;
  unidad: string;
}

const JUEGOS: JuegoCard[] = [
  {
    id: 'rompe_platos',
    nombre: 'Rompe Platos',
    descripcion: 'Dispara a los platos antes de que escapen',
    icono: '🎯',
    fondoIcono: '#FFF3D0',
    colorMarca: '#FFAE00',
    ruta: '/juego',
    tipoJuego: 'rompe_platos',
    unidad: '',
  },
  {
    id: 'reflejos',
    nombre: 'Test de Reflejos',
    descripcion: 'Mide la velocidad de tu reacción',
    icono: '⚡',
    fondoIcono: '#E8F5E9',
    colorMarca: '#10B981',
    ruta: '/juegos/reflejos',
    tipoJuego: 'reflejos',
    unidad: 'ms',
  },
  {
    id: 'lateralidad',
    nombre: 'Izquierda o Derecha',
    descripcion: 'Entrena tu lateralidad y coordinación',
    icono: '↔️',
    fondoIcono: '#E3F2FD',
    colorMarca: '#3B82F6',
    ruta: '/juegos/lateralidad',
    tipoJuego: 'lateralidad',
    unidad: 'ms',
  },
];

@Component({
  selector: 'app-juegos-hub',
  standalone: true,
  imports: [SlicePipe],
  templateUrl: './juegos-hub.component.html',
  styleUrl: './juegos-hub.component.scss',
})
export class JuegosHubComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private juegosService = inject(JuegosService);

  readonly juegos = JUEGOS;

  rankingTipo = signal<string>('reflejos');

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  userId = computed(() => this.user()?.id ?? null);

  mejoresMarcas = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => (u?.id ? this.juegosService.getMisMejoresMarcas(u.id) : EMPTY))
    ),
    { initialValue: new Map<string, number>() }
  );

  ranking = toSignal(
    toObservable(this.rankingTipo).pipe(
      switchMap(tipo => this.juegosService.getRanking(tipo, 5))
    ),
    { initialValue: [] as RankingJuego[] }
  );

  formatMarca(juego: JuegoCard): string {
    const marcas = this.mejoresMarcas();
    const valor = marcas.get(juego.tipoJuego);
    if (valor === undefined) return '—';
    if (juego.unidad) return `${valor}${juego.unidad}`;
    return String(valor);
  }

  formatRankingValor(val: number): string {
    const tipo = this.rankingTipo();
    const juego = JUEGOS.find(j => j.tipoJuego === tipo);
    if (juego?.unidad) return `${val}${juego.unidad}`;
    return String(val);
  }

  irAJuego(ruta: string): void {
    this.router.navigate([ruta]);
  }

  cambiarRanking(tipo: string): void {
    this.rankingTipo.set(tipo);
  }
}
