import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { InscripcionTorneoService } from '../inscripcion-torneo.service';
import { TorneoService } from '../torneo.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Torneo } from '../../../../core/models/torneo.model';
import { InscritoVista } from '../../../../core/models/inscripcion-torneo.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-inscripciones-torneo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inscripciones-torneo.component.html',
  styleUrl: './inscripciones-torneo.component.scss',
})
export class InscripcionesTorneoComponent {
  private route         = inject(ActivatedRoute);
  private torneoService = inject(TorneoService);
  private inscService   = inject(InscripcionTorneoService);
  private userService   = inject(UserService);
  private authService   = inject(AuthService);

  torneo             = signal<Torneo | null>(null);
  inscritos          = signal<InscritoVista[]>([]);
  sociosDisponibles  = signal<User[]>([]);

  nuevoSocioId = '';
  nuevoNombre = '';
  nuevoApellidos = '';

  loading = signal(true);
  error   = signal('');

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      this.torneo.set(await firstValueFrom(this.torneoService.getById(id)));
      await this.recargar();
    } catch (e: any) {
      this.error.set(e.message ?? 'Error cargando torneo');
    } finally {
      this.loading.set(false);
    }
  }

  async recargar() {
    const id = this.torneo()!.id;
    const [inscritos, users] = await Promise.all([
      this.inscService.listarInscritos(id),
      firstValueFrom(this.userService.getAll()),
    ]);
    this.inscritos.set(inscritos);
    const yaInscritos = new Set(
      inscritos.filter(i => !i.esNoSocio && i.userId).map(i => i.userId!)
    );
    this.sociosDisponibles.set(
      users
        .filter(u => u.activo && u.rol !== 'admin' && !yaInscritos.has(u.id))
        .sort((a, b) =>
          `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es')
        )
    );
  }

  async inscribirSocio() {
    if (!this.nuevoSocioId) return;
    const me = this.authService.currentUser;
    if (!me) return;
    this.error.set('');
    try {
      await this.inscService.inscribirSocio(this.torneo()!.id, this.nuevoSocioId, me.id);
      this.nuevoSocioId = '';
      await this.recargar();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  async inscribirInvitado() {
    const n = this.nuevoNombre.trim();
    const a = this.nuevoApellidos.trim();
    if (!n || !a) return;
    const me = this.authService.currentUser;
    if (!me) return;
    this.error.set('');
    try {
      await this.inscService.inscribirInvitado(this.torneo()!.id, n, a, me.id);
      this.nuevoNombre = '';
      this.nuevoApellidos = '';
      await this.recargar();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  async eliminar(i: InscritoVista) {
    if (i.enEscuadra) {
      this.error.set('No se puede eliminar: ya está asignado a una escuadra');
      return;
    }
    if (!confirm(`¿Eliminar la inscripción de ${i.nombre} ${i.apellidos}?`)) return;
    try {
      await this.inscService.eliminarInscripcion(i);
      await this.recargar();
    } catch (e: any) {
      this.error.set(e.message);
    }
  }

  get totalRecaudado(): number {
    return this.inscritos().reduce((s, i) => s + i.precioPagado, 0);
  }
}
