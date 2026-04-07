import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { EscuadraService } from '../../../scores/escuadra.service';
import { UserService } from '../../socios/user.service';
import { User } from '../../../../core/models/user.model';

interface PuestoState {
  userId: string | null;
  query: string;
  open: boolean;
}

@Component({
  selector: 'app-form-escuadra',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-escuadra.component.html',
  styleUrl: './form-escuadra.component.scss',
})
export class FormEscuadraComponent {
  private escuadraService = inject(EscuadraService);
  private userService = inject(UserService);
  private router = inject(Router);

  socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

  puestos = signal<PuestoState[]>(
    Array.from({ length: 6 }, () => ({ userId: null, query: '', open: false }))
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
      ps.map((p, i) => i === index ? { ...p, query: value, userId: null, open: true } : p)
    );
  }

  seleccionar(index: number, socio: User): void {
    this.puestos.update(ps =>
      ps.map((p, i) =>
        i === index
          ? { ...p, userId: socio.id, query: `${socio.nombre} ${socio.apellidos}`, open: false }
          : p
      )
    );
  }

  limpiar(index: number): void {
    this.puestos.update(ps =>
      ps.map((p, i) => i === index ? { ...p, userId: null, query: '', open: false } : p)
    );
  }

  abrirDropdown(index: number): void {
    this.puestos.update(ps =>
      ps.map((p, i) => i === index ? { ...p, open: true } : { ...p, open: false })
    );
  }

  cerrarDropdown(index: number): void {
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
      const escuadras = await firstValueFrom(this.escuadraService.getByCompeticion(null));
      const siguienteNumero = escuadras.length + 1;
      const escuadraId = await this.escuadraService.createEscuadra(null, siguienteNumero);
      for (let i = 0; i < this.puestos().length; i++) {
        const userId = this.puestos()[i].userId;
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
