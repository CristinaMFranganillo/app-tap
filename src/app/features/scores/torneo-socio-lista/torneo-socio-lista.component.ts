import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { TorneoService } from '../../admin/torneos/torneo.service';
import { Torneo } from '../../../core/models/torneo.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-torneo-socio-lista',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './torneo-socio-lista.component.html',
  styleUrl: './torneo-socio-lista.component.scss',
})
export class TorneoSocioListaComponent {
  private torneoService = inject(TorneoService);
  private router = inject(Router);

  torneos = toSignal(this.torneoService.getAll(), { initialValue: [] as Torneo[] });

  irDetalle(torneo: Torneo): void {
    this.router.navigate(['/scores/torneos', torneo.id]);
  }
}
