import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { User } from '../../../../core/models/user.model';
@Component({
  selector: 'app-form-escuadra',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-escuadra.component.html',
})
export class FormEscuadraComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private router = inject(Router);

  socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

  puestos: (string | null)[] = [null, null, null, null, null, null];
  loading = false;
  error = '';

  async onSubmit(): Promise<void> {
    const asignados = this.puestos.filter(p => p !== null);
    if (asignados.length === 0) { this.error = 'Asigna al menos un tirador'; return; }
    this.loading = true;
    this.error = '';
    try {
      const escuadras = await firstValueFrom(this.escuadraService.getByCompeticion(null));
      const siguienteNumero = escuadras.length + 1;
      const escuadraId = await this.escuadraService.createEscuadra(null, siguienteNumero);
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
