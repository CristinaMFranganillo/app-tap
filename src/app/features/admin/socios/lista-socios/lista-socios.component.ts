import { Component, HostListener, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, startWith } from 'rxjs';
import { UserService } from '../user.service';
import { CuotaService } from '../cuota.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { User } from '../../../../core/models/user.model';
import { Cuota } from '../../../../core/models/cuota.model';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-lista-socios',
  standalone: true,
  imports: [FormsModule, AvatarComponent, ConfirmDialogComponent],
  templateUrl: './lista-socios.component.html',
  styleUrl: './lista-socios.component.scss',
})
export class ListaSociosComponent {
  private userService = inject(UserService);
  private cuotaService = inject(CuotaService);
  private router = inject(Router);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.menuAbierto.set(null);
  }

  searchTerm = signal('');
  showFilters = signal(false);
  filterFavoritos = signal(false);
  filterCuota = signal<'todas' | 'pagada' | 'no-pagada'>('todas');
  filterBaja = signal(false);
  sortAlfa = signal(false);
  expandedId = signal<string | null>(null);
  menuAbierto = signal<string | null>(null);
  pendingDeleteId = signal<string | null>(null);
  pendingBajaId = signal<string | null>(null);
  pendingAltaId = signal<string | null>(null);
  pendingCuotaSocio = signal<User | null>(null);
  cuotasHistorial = signal<Record<string, Cuota[]>>({});
  private refresh$ = new Subject<void>();

  private socios = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.userService.getAll())),
    { initialValue: [] as User[] }
  );

  sinTemporada = computed(() => {
    if (this.filterCuota() === 'todas') return false;
    const list = this.socios();
    return list.length > 0 && list.every(s => s.cuotaPagada === undefined);
  });

  filteredSocios = computed(() => {
    const term = this.searchTerm().toLowerCase();
    let list = this.socios();

    // Filtro por texto
    if (term) {
      list = list.filter(s =>
        s.nombre.toLowerCase().includes(term) ||
        s.apellidos.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        String(s.numeroSocio).includes(term)
      );
    }

    // Filtro favoritos
    if (this.filterFavoritos()) {
      list = list.filter(s => s.favorito);
    }

    // Filtro cuota
    const cuota = this.filterCuota();
    if (cuota === 'pagada') {
      list = list.filter(s => s.cuotaPagada === true);
    } else if (cuota === 'no-pagada') {
      list = list.filter(s => s.cuotaPagada === false);
    }

    // Filtro baja
    if (this.filterBaja()) {
      list = list.filter(s => !s.activo);
    }

    // Ordenación: inactivos siempre al final
    return [...list].sort((a, b) => {
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      if (this.sortAlfa()) {
        return a.apellidos.localeCompare(b.apellidos, 'es');
      }
      if (a.favorito === b.favorito) return 0;
      return a.favorito ? -1 : 1;
    });
  });

  async toggleActivo(id: string): Promise<void> {
    await this.userService.toggleActivo(id);
    this.refresh$.next();
  }

  toggleExpanded(id: string): void {
    if (this.expandedId() === id) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(id);
    this.cuotaService.getCuotasSocio(id).subscribe(cuotas => {
      this.cuotasHistorial.update(h => ({ ...h, [id]: cuotas }));
    });
  }

  goToCreate(): void {
    this.router.navigate(['/admin/socios/nuevo']);
  }

  goToTemporadas(): void {
    this.router.navigate(['/admin/temporadas']);
  }

  goToEdit(id: string): void {
    this.menuAbierto.set(null);
    this.router.navigate(['/admin/socios', id]);
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.menuAbierto.set(this.menuAbierto() === id ? null : id);
  }

  toggleFavoritoFromMenu(socio: User): void {
    this.menuAbierto.set(null);
    this.toggleFavorito(socio, new Event('click'));
  }

  confirmarEliminarFromMenu(id: string): void {
    this.menuAbierto.set(null);
    this.confirmarEliminar(id);
  }

  confirmarDarDeBajaFromMenu(id: string): void {
    this.menuAbierto.set(null);
    this.confirmarDarDeBaja(id);
  }

  confirmarDarDeAltaFromMenu(id: string): void {
    this.menuAbierto.set(null);
    this.confirmarDarDeAlta(id);
  }

  confirmarEliminar(id: string): void {
    this.pendingDeleteId.set(id);
  }

  async eliminar(): Promise<void> {
    const id = this.pendingDeleteId();
    if (!id) return;
    this.pendingDeleteId.set(null);
    await this.userService.eliminar(id);
    this.refresh$.next();
  }

  cancelarEliminar(): void {
    this.pendingDeleteId.set(null);
  }

  confirmarDarDeBaja(id: string): void {
    this.pendingBajaId.set(id);
  }

  async ejecutarDarDeBaja(): Promise<void> {
    const id = this.pendingBajaId();
    if (!id) return;
    this.pendingBajaId.set(null);
    await this.userService.desactivarSocio(id);
    this.refresh$.next();
  }

  confirmarDarDeAlta(id: string): void {
    this.pendingAltaId.set(id);
  }

  async ejecutarDarDeAlta(): Promise<void> {
    const id = this.pendingAltaId();
    if (!id) return;
    this.pendingAltaId.set(null);
    await this.userService.update(id, { activo: true });
    this.refresh$.next();
  }

  confirmarCuota(socio: User, event: Event): void {
    event.stopPropagation();
    if (socio.cuotaId === undefined) return;
    this.pendingCuotaSocio.set(socio);
  }

  async ejecutarToggleCuota(): Promise<void> {
    const socio = this.pendingCuotaSocio();
    if (!socio || socio.cuotaId === undefined) return;
    this.pendingCuotaSocio.set(null);
    await this.cuotaService.toggleCuota(socio.cuotaId, !socio.cuotaPagada);
    this.refresh$.next();
  }

  cancelarCuota(): void {
    this.pendingCuotaSocio.set(null);
  }

  async toggleFavorito(socio: User, event: Event): Promise<void> {
    event.stopPropagation();
    await this.userService.toggleFavorito(socio.id);
    this.refresh$.next();
  }

  hayFiltrosActivos(): boolean {
    return this.filterFavoritos() || this.filterCuota() !== 'todas' || this.filterBaja();
  }

  /** Evita `#{{ ... }}` y valores null; el listado debe mostrar siempre texto legible. */
  displayNumeroSocio(s: User): string {
    const t = String(s.numeroSocio ?? '').trim();
    return t ? `#${t}` : '—';
  }

  displayRol(s: User): string {
    const labels: Record<User['rol'], string> = {
      socio: 'Socio',
      moderador: 'Moderador',
      admin: 'Admin',
    };
    return labels[s.rol] ?? '—';
  }
}
