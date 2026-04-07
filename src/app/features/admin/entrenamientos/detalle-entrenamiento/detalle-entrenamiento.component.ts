import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { Entrenamiento } from '../../../../core/models/entrenamiento.model';
import { Escuadra } from '../../../../core/models/escuadra.model';
import { DatePipe } from '@angular/common';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-detalle-entrenamiento',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './detalle-entrenamiento.component.html',
  styleUrl: './detalle-entrenamiento.component.scss',
})
export class DetalleEntrenamientoComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);

  private id$ = this.route.paramMap.pipe(map(p => p.get('id')!));

  entrenamiento = toSignal(
    this.id$.pipe(switchMap(id => this.entrenamientoService.getById(id))),
    { initialValue: null as Entrenamiento | null }
  );

  escuadras = toSignal(
    this.id$.pipe(switchMap(id => this.escuadraService.getByEntrenamiento(id))),
    { initialValue: [] as Escuadra[] }
  );

  nuevaEscuadra(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', id, 'escuadra', 'nueva']);
  }

  irResultados(escuadraId: string): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', id, 'escuadra', escuadraId, 'resultados']);
  }

  goBack(): void {
    this.router.navigate(['/admin/scores']);
  }
}
