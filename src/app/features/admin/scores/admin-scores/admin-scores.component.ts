import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CompeticionService } from '../../../scores/competicion.service';
import { Competicion } from '../../../../core/models/competicion.model';

@Component({
  selector: 'app-admin-scores',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './admin-scores.component.html',
})
export class AdminScoresComponent {
  private competicionService = inject(CompeticionService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });

  nuevaCompeticion(): void {
    this.router.navigate(['/admin/competiciones/nueva']);
  }

  nuevaEscuadra(): void {
    this.router.navigate(['/admin/scores/escuadra/nueva']);
  }

  registrarResultados(): void {
    this.router.navigate(['/admin/scores/resultados']);
  }

  totalPlatos(c: Competicion): number {
    return c.platosPorSerie * c.numSeries;
  }
}
