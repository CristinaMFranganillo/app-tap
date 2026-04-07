import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
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
  menuAbierto = signal(false);

  toggleMenu(): void {
    this.menuAbierto.update(v => !v);
  }

  logout(): void {
    this.menuAbierto.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
