import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CompeticionService } from '../../../scores/competicion.service';
import { EntrenamientoService } from '../../entrenamientos/entrenamiento.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { Entrenamiento } from '../../../../core/models/entrenamiento.model';

@Component({
  selector: 'app-admin-scores',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admin-scores.component.html',
  styleUrl: './admin-scores.component.scss',
})
export class AdminScoresComponent {
  private competicionService = inject(CompeticionService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  entrenamientos = toSignal(this.entrenamientoService.getAll(), { initialValue: [] as Entrenamiento[] });

  nuevoEntrenamiento(): void {
    this.router.navigate(['/admin/entrenamientos/nuevo']);
  }

  verEntrenamiento(id: string): void {
    this.router.navigate(['/admin/entrenamientos', id]);
  }

  nuevaCompeticion(): void {
    this.router.navigate(['/admin/competiciones/nueva']);
  }

  totalPlatos(c: Competicion): number {
    return c.platosPorSerie * c.numSeries;
  }
}
