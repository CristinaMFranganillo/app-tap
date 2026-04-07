import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe, DatePipe } from '@angular/common';
import { Subject, switchMap, startWith } from 'rxjs';
import { UserService } from '../user.service';
import { CuotaService } from '../cuota.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { User } from '../../../../core/models/user.model';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-lista-socios',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, DatePipe, AvatarComponent, ConfirmDialogComponent],
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
  private refresh$ = new Subject<void>();

  private socios = toSignal(
    this.refresh$.pipe(startWith(null), switchMap(() => this.userService.getAll())),
    { initialValue: [] as User[] }
  );

  filteredSocios = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.socios();
    return this.socios().filter(s =>
      s.nombre.toLowerCase().includes(term) ||
      s.apellidos.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.numeroSocio.includes(term)
    );
  });

  async toggleActivo(id: string): Promise<void> {
    await this.userService.toggleActivo(id);
    this.refresh$.next();
  }

  toggleExpanded(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  goToCreate(): void {
    this.router.navigate(['/admin/socios/nuevo']);
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
}
