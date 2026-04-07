import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { supabase } from '../../../core/supabase/supabase.client';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  error = '';
  loading = false;

  mostrarPassword = signal(false);

  // Recuperar contraseña
  mostrarRecuperar = signal(false);
  recuperarEmail   = '';
  recuperarLoading = signal(false);
  recuperarMsg     = signal('');
  recuperarError   = signal('');

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe(({ error }) => {
      this.loading = false;
      if (error) {
        this.error = error;
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  abrirRecuperar(): void {
    this.mostrarRecuperar.set(true);
    this.recuperarMsg.set('');
    this.recuperarError.set('');
    this.recuperarEmail = this.form.value.email ?? '';
  }

  cerrarRecuperar(): void {
    this.mostrarRecuperar.set(false);
  }

  async enviarRecuperar(): Promise<void> {
    if (!this.recuperarEmail) {
      this.recuperarError.set('Introduce tu email.');
      return;
    }
    this.recuperarLoading.set(true);
    this.recuperarError.set('');
    const { error } = await supabase.auth.resetPasswordForEmail(this.recuperarEmail, {
      redirectTo: `${window.location.origin}/`,
    });
    this.recuperarLoading.set(false);
    if (error) {
      this.recuperarError.set('No se pudo enviar el email. Comprueba la dirección.');
    } else {
      this.recuperarMsg.set('Te hemos enviado un email con instrucciones para restablecer tu contraseña.');
    }
  }
}
