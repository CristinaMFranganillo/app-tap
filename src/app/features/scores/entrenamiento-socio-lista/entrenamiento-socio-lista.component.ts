import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, EMPTY } from 'rxjs';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { EntrenamientoService } from '../../admin/entrenamientos/entrenamiento.service';
import { ResultadoEntrenamientoConFecha } from '../../../core/models/entrenamiento.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-entrenamiento-socio-lista',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './entrenamiento-socio-lista.component.html',
  styleUrl: './entrenamiento-socio-lista.component.scss',
})
export class EntrenamientoSocioListaComponent {
  private auth = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);
  private router = inject(Router);

  private anio = new Date().getFullYear();

  entrenamientos = toSignal(
    this.auth.currentUser$.pipe(
      switchMap(user =>
        user?.id ? this.entrenamientoService.getByUser(user.id, this.anio) : EMPTY
      )
    ),
    { initialValue: [] as ResultadoEntrenamientoConFecha[] }
  );

  irDetalle(e: ResultadoEntrenamientoConFecha): void {
    this.router.navigate(
      ['/scores/entrenamientos', e.escuadraId],
      { queryParams: { fecha: e.fecha, platosRotos: e.platosRotos } }
    );
  }
}
