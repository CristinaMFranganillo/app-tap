import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { BottomNavComponent } from '../../shared/components/bottom-nav/bottom-nav.component';
import { CambiarPasswordComponent } from '../../shared/components/cambiar-password/cambiar-password.component';
import { AuthService } from '../../core/auth/auth.service';
import { supabase } from '../../core/supabase/supabase.client';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent, CambiarPasswordComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private auth = inject(AuthService);
  mostrarCambioPassword = signal(false);
  cambioPasswordManual  = signal(false);

  ngOnInit(): void {
    if (this.auth.currentUser?.firstLogin) {
      this.mostrarCambioPassword.set(true);
    }

    // Detectar evento de recuperación de contraseña (enlace de email)
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.cambioPasswordManual.set(true);
      }
    });
  }

  onPasswordCerrado(): void {
    this.mostrarCambioPassword.set(false);
    this.cambioPasswordManual.set(false);
  }

  abrirCambioPassword(): void {
    this.cambioPasswordManual.set(true);
  }
}
