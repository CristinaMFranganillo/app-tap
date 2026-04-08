import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { EntrenamientoService } from '../../admin/entrenamientos/entrenamiento.service';

@Component({
  selector: 'app-entrenamiento-socio-detalle',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './entrenamiento-socio-detalle.component.html',
  styleUrl: './entrenamiento-socio-detalle.component.scss',
})
export class EntrenamientoSocioDetalleComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private entrenamientoService = inject(EntrenamientoService);

  fecha = this.route.snapshot.queryParamMap.get('fecha') ?? '';
  platosRotos = Number(this.route.snapshot.queryParamMap.get('platosRotos') ?? 0);
  escuadraId = this.route.snapshot.paramMap.get('escuadraId')!;

  fallos = signal<number[]>([]);

  constructor() {
    const userId = this.auth.currentUser?.id;
    if (userId && this.escuadraId) {
      firstValueFrom(
        this.entrenamientoService.getFallosByEscuadra(this.escuadraId)
      ).then(todos => {
        const mios = todos
          .filter(f => f.userId === userId)
          .map(f => f.numeroPlato)
          .sort((a, b) => a - b);
        this.fallos.set(mios);
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/scores/entrenamientos']);
  }
}
