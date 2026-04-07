import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe, DatePipe } from '@angular/common';
import { Subject, switchMap, startWith } from 'rxjs';
import { UserService } from '../user.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { User } from '../../../../core/models/user.model';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-lista-socios',
  standalone: true,
  imports: [FormsModule, TitleCasePipe, DatePipe, AvatarComponent],
  templateUrl: './lista-socios.component.html',
  styleUrl: './lista-socios.component.scss',
})
export class ListaSociosComponent {
  private userService = inject(UserService);
  private router = inject(Router);

  searchTerm = signal('');
  expandedId = signal<string | null>(null);
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

  async eliminar(id: string): Promise<void> {
    if (!confirm('¿Eliminar este socio? Esta acción no se puede deshacer.')) return;
    await this.userService.eliminar(id);
    this.refresh$.next();
  }
}
