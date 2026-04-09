import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { TorneoService } from '../../admin/torneos/torneo.service';
import { Torneo, RankingTorneo } from '../../../core/models/torneo.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-torneo-socio-detalle',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './torneo-socio-detalle.component.html',
  styleUrl: './torneo-socio-detalle.component.scss',
})
export class TorneoSocioDetalleComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private torneoService = inject(TorneoService);

  private id$ = this.route.paramMap.pipe(map(p => p.get('id')!));

  torneo = toSignal<Torneo | null>(
    this.id$.pipe(switchMap(id => this.torneoService.getById(id))),
    { initialValue: null }
  );

  ranking = toSignal(
    this.id$.pipe(switchMap(id => this.torneoService.getRanking(id))),
    { initialValue: [] as RankingTorneo[] }
  );

  hayRanking = computed(() => this.ranking().length > 0);

  goBack(): void {
    this.router.navigate(['/scores/torneos']);
  }
}
