import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-escuadra-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-escuadra-entrenamiento.component.html',
  styleUrl: './form-escuadra-entrenamiento.component.scss',
})
export class FormEscuadraEntrenamientoComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);
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
      const entrenamientoId = this.route.snapshot.paramMap.get('id')!;
      const escuadras = await firstValueFrom(this.escuadraService.getByEntrenamiento(entrenamientoId));
      const numero = escuadras.length + 1;
      const escuadraId = await this.escuadraService.createEscuadraEntrenamiento(entrenamientoId, numero);
      for (let i = 0; i < this.puestos.length; i++) {
        const userId = this.puestos[i];
        if (userId) await this.escuadraService.addTirador(escuadraId, userId, i + 1);
      }
      this.router.navigate(['/admin/entrenamientos', entrenamientoId]);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      this.loading = false;
    }
  }

  cancel(): void {
    const entrenamientoId = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/admin/entrenamientos', entrenamientoId]);
  }
}
