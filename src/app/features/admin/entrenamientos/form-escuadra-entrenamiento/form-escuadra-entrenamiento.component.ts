import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../../features/scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { User } from '../../../../core/models/user.model';

interface PuestoState {
  userId: string | null;
  nombre: string;       // texto mostrado en el input
  query: string;        // texto de búsqueda
  open: boolean;        // dropdown abierto
}

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

  puestos = signal<PuestoState[]>(
    Array.from({ length: 6 }, () => ({ userId: null, nombre: '', query: '', open: false }))
  );

  loading = false;
  error = '';

  filtrados(index: number): User[] {
    const q = this.puestos()[index].query.toLowerCase().trim();
    if (!q) return this.socios().slice(0, 8);
    return this.socios()
      .filter(s => `${s.nombre} ${s.apellidos}`.toLowerCase().includes(q))
      .slice(0, 8);
  }

  onQuery(index: number, value: string): void {
    this.puestos.update(ps =>
      ps.map((p, i) => i === index ? { ...p, query: value, userId: null, nombre: '', open: true } : p)
    );
  }

  seleccionar(index: number, socio: User): void {
    this.puestos.update(ps =>
      ps.map((p, i) =>
        i === index
          ? { ...p, userId: socio.id, nombre: `${socio.nombre} ${socio.apellidos}`, query: `${socio.nombre} ${socio.apellidos}`, open: false }
          : p
      )
    );
  }

  limpiar(index: number): void {
    this.puestos.update(ps =>
      ps.map((p, i) => i === index ? { ...p, userId: null, nombre: '', query: '', open: false } : p)
    );
  }

  abrirDropdown(index: number): void {
    this.puestos.update(ps =>
      ps.map((p, i) => i === index ? { ...p, open: true } : { ...p, open: false })
    );
  }

  cerrarDropdown(index: number): void {
    // Pequeño delay para que el click en opción se registre antes de cerrar
    setTimeout(() => {
      this.puestos.update(ps =>
        ps.map((p, i) => i === index ? { ...p, open: false } : p)
      );
    }, 150);
  }

  async onSubmit(): Promise<void> {
    const asignados = this.puestos().filter(p => p.userId !== null);
    if (asignados.length === 0) { this.error = 'Asigna al menos un tirador'; return; }
    this.loading = true;
    this.error = '';
    try {
      const entrenamientoId = this.route.snapshot.paramMap.get('id')!;
      const escuadras = await firstValueFrom(this.escuadraService.getByEntrenamiento(entrenamientoId));
      const numero = escuadras.length + 1;
      const escuadraId = await this.escuadraService.createEscuadraEntrenamiento(entrenamientoId, numero);
      for (let i = 0; i < this.puestos().length; i++) {
        const userId = this.puestos()[i].userId;
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
