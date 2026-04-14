import { Component, computed, inject, output, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, AvatarComponent, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly currentUser$ = this.auth.currentUser$;
  private user = toSignal(this.currentUser$, { initialValue: null });
  esAdmin = computed(() => {
    const rol = this.user()?.rol;
    return rol === 'admin' || rol === 'moderador';
  });
  menuAbierto      = signal(false);
  cambiarPassword  = output<void>();

  toggleMenu(): void {
    this.menuAbierto.update(v => !v);
  }

  onCambiarPassword(): void {
    this.menuAbierto.set(false);
    this.cambiarPassword.emit();
  }

  async logout(): Promise<void> {
    this.menuAbierto.set(false);
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
