import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../scores/escuadra.service';
import { CompeticionService } from '../../../scores/competicion.service';
import { UserService } from '../../socios/user.service';
import { Competicion } from '../../../../core/models/competicion.model';
import { User } from '../../../../core/models/user.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-form-escuadra',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './form-escuadra.component.html',
})
export class FormEscuadraComponent {
  private escuadraService = inject(EscuadraService);
  private competicionService = inject(CompeticionService);
  private userService = inject(UserService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

  competicionId = '';
  puestos: (string | null)[] = [null, null, null, null, null, null];
  loading = false;
  error = '';

  async onSubmit(): Promise<void> {
    if (!this.competicionId) { this.error = 'Selecciona una competición'; return; }
    const asignados = this.puestos.filter(p => p !== null);
    if (asignados.length === 0) { this.error = 'Asigna al menos un tirador'; return; }
    this.loading = true;
    this.error = '';
    try {
      const escuadras = await firstValueFrom(this.escuadraService.getByCompeticion(this.competicionId));
      const siguienteNumero = escuadras.length + 1;
      const escuadraId = await this.escuadraService.createEscuadra(this.competicionId, siguienteNumero);
      for (let i = 0; i < this.puestos.length; i++) {
        const userId = this.puestos[i];
        if (userId) {
          await this.escuadraService.addTirador(escuadraId, userId, i + 1);
        }
      }
      this.router.navigate(['/admin/scores']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/scores']);
  }
}
