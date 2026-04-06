import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ResultadoService } from '../../../scores/resultado.service';
import { EscuadraService } from '../../../scores/escuadra.service';
import { CompeticionService } from '../../../scores/competicion.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { Escuadra, EscuadraTirador } from '../../../../core/models/escuadra.model';

@Component({
  selector: 'app-registrar-resultado',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registrar-resultado.component.html',
})
export class RegistrarResultadoComponent {
  private resultadoService = inject(ResultadoService);
  private escuadraService = inject(EscuadraService);
  private competicionService = inject(CompeticionService);
  private userService = inject(UserService);
  private auth = inject(AuthService);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });

  // Asegurar que el cache de socios está cargado
  private _socios = toSignal(this.userService.getAll(), { initialValue: [] });

  competicionId = signal('');
  serieActual = signal(1);
  platoActual = signal(1);

  escuadras = toSignal(
    toObservable(this.competicionId).pipe(
      switchMap(id => id ? this.escuadraService.getByCompeticion(id) : [])
    ),
    { initialValue: [] as Escuadra[] }
  );

  escuadraId = signal('');

  tiradores = toSignal(
    toObservable(this.escuadraId).pipe(
      switchMap(id => id ? this.escuadraService.getTiradoresByEscuadra(id) : [])
    ),
    { initialValue: [] as EscuadraTirador[] }
  );

  competicionActual = computed(() =>
    this.competiciones().find(c => c.id === this.competicionId())
  );

  saving = signal(false);

  getUserNombre(userId: string): string {
    const u = this.userService.getById(userId);
    return u ? `${u.nombre} ${u.apellidos}` : userId;
  }

  incrementSerie(): void { this.serieActual.update(s => s + 1); }
  decrementSerie(): void { this.serieActual.update(s => Math.max(1, s - 1)); }
  incrementPlato(): void { this.platoActual.update(p => p + 1); }
  decrementPlato(): void { this.platoActual.update(p => Math.max(1, p - 1)); }

  async registrar(userId: string, resultado: 0 | 1): Promise<void> {
    const adminId = this.auth.currentUser?.id ?? '';
    this.saving.set(true);
    try {
      await this.resultadoService.upsert({
        competicionId: this.competicionId(),
        userId,
        serie: this.serieActual(),
        plato: this.platoActual(),
        resultado,
      }, adminId);
      const comp = this.competicionActual();
      const maxPlatos = comp?.platosPorSerie ?? 25;
      if (this.platoActual() < maxPlatos) {
        this.platoActual.update(p => p + 1);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
