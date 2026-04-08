import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
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
  imports: [FormsModule, TitleCasePipe, AvatarComponent, ConfirmDialogComponent],
  templateUrl: './lista-socios.component.html',
  styleUrl: './lista-socios.component.scss',
})
export class ListaSociosComponent {
  private userService = inject(UserService);
  private cuotaService = inject(CuotaService);
  private router = inject(Router);

  searchTerm = signal('');
  expandedId = signal<string | null>(null);
  pendingDeleteId = signal<string | null>(null);
  cuotasHistorial = signal<Record<string, Cuota[]>>({});
  private refresh$ = new Subject<void>();

  private socios = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.userService.getAll())),
    { initialValue: [] as User[] }
  );

  filteredSocios = computed(() => {
    const term = this.searchTerm().toLowerCase();
    let list = this.socios();
    if (term) {
      list = list.filter(s =>
        s.nombre.toLowerCase().includes(term) ||
        s.apellidos.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.numeroSocio.includes(term)
      );
    }
    return [...list].sort((a, b) => {
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
    this.router.navigate(['/admin/socios', id]);
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

  async toggleCuota(socio: User, event: Event): Promise<void> {
    event.stopPropagation();
    if (socio.cuotaId === undefined) return;
    await this.cuotaService.toggleCuota(socio.cuotaId, !socio.cuotaPagada);
    this.refresh$.next();
  }

  async toggleFavorito(socio: User, event: Event): Promise<void> {
    event.stopPropagation();
    await this.userService.toggleFavorito(socio.id);
    this.refresh$.next();
  }
}
