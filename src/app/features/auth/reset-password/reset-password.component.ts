import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { supabase } from '../../../core/supabase/supabase.client';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password  = group.get('password')?.value;
  const confirmar = group.get('confirmar')?.value;
  return password && confirmar && password !== confirmar
    ? { passwordMismatch: true }
    : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  private redirectTimeout?: ReturnType<typeof setTimeout>;

  form = this.fb.group({
    password:  ['', [Validators.required, Validators.minLength(6)]],
    confirmar: ['', [Validators.required, Validators.minLength(6)]],
  }, { validators: passwordMatchValidator });

  mostrarPassword  = signal(false);
  mostrarConfirmar = signal(false);
  loading          = signal(false);
  error            = signal('');
  exito            = signal(false);
  tokenValido      = signal(false);
  tokenError       = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token') ?? '';
      const type         = params.get('type');

      if (!accessToken || type !== 'recovery') {
        this.router.navigate(['/login']);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token:  accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        this.router.navigate(['/login']);
        return;
      }

      this.tokenValido.set(true);
    } catch {
      this.tokenError.set(true);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.redirectTimeout);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) return;
    const { password } = this.form.value;
    this.loading.set(true);
    this.error.set('');
    const { error } = await supabase.auth.updateUser({ password: password! });
    this.loading.set(false);
    if (error) {
      this.error.set('No se pudo cambiar la contraseña. El enlace puede haber expirado.');
    } else {
      this.exito.set(true);
      await supabase.auth.signOut();
      this.redirectTimeout = setTimeout(() => this.router.navigate(['/login']), 2500);
    }
  }
}
