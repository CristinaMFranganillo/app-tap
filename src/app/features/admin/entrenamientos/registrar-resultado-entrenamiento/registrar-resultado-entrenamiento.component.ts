import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EntrenamientoService } from '../entrenamiento.service';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';

interface PuestoForm {
  userId: string;
  nombre: string;
  platosRotos: number;
  puesto: number;
}

@Component({
  selector: 'app-registrar-resultado-entrenamiento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './registrar-resultado-entrenamiento.component.html',
  styleUrl: './registrar-resultado-entrenamiento.component.scss',
})
export class RegistrarResultadoEntrenamientoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private entrenamientoService = inject(EntrenamientoService);
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private authService = inject(AuthService);

  private escuadraId = this.route.snapshot.paramMap.get('escuadraId')!;
  private entrenamientoId = this.route.snapshot.paramMap.get('entrenamientoId')!;

  private socios = toSignal(this.userService.getAll(), { initialValue: [] });
  private tiradores = toSignal(
    this.escuadraService.getTiradoresByEscuadra(this.escuadraId),
    { initialValue: [] }
  );

  puestos = computed<PuestoForm[]>(() => {
    const socios = this.socios();
    return this.tiradores().map(t => {
      const socio = socios.find(s => s.id === t.userId);
      return {
        userId: t.userId,
        nombre: socio ? `${socio.nombre} ${socio.apellidos}` : t.userId,
        platosRotos: 0,
        puesto: t.puesto,
      };
    });
  });

  puestosForm = signal<PuestoForm[]>([]);
  saving = signal(false);
  error = signal('');

  ngOnInit(): void {
    this.puestosForm.set(this.puestos().map(p => ({ ...p })));
  }

  async guardar(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) throw new Error('No autenticado');
      await this.entrenamientoService.upsertResultados(
        this.puestosForm().map(p => ({
          escuadraId: this.escuadraId,
          userId: p.userId,
          puesto: p.puesto,
          platosRotos: p.platosRotos,
        })),
        user.id
      );
      this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/entrenamientos', this.entrenamientoId]);
  }
}
