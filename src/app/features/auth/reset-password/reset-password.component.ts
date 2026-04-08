import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../../core/supabase/supabase.client';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  form = this.fb.group({
    password:  ['', [Validators.required, Validators.minLength(6)]],
    confirmar: ['', Validators.required],
  });

  mostrarPassword  = signal(false);
  mostrarConfirmar = signal(false);
  loading          = signal(false);
  error            = signal('');
  exito            = signal(false);
  tokenValido      = signal(false);

  async ngOnInit(): Promise<void> {
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
  }

  async guardar(): Promise<void> {
    const { password, confirmar } = this.form.value;
    if (password !== confirmar) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { error } = await supabase.auth.updateUser({ password: password! });
    this.loading.set(false);
    if (error) {
      this.error.set('No se pudo cambiar la contraseña. El enlace puede haber expirado.');
    } else {
      this.exito.set(true);
      await supabase.auth.signOut();
      setTimeout(() => this.router.navigate(['/login']), 2500);
    }
  }
}
