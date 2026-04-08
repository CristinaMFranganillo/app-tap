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

  ngOnInit(): void {
    // El SDK de Supabase consume el hash automáticamente antes de que Angular
    // pueda leerlo. Escuchamos onAuthStateChange para capturar PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.tokenValido.set(true);
        subscription.unsubscribe();
      }
    });

    // Si tras 5 segundos no llega el evento, el enlace es inválido
    this.redirectTimeout = setTimeout(() => {
      if (!this.tokenValido()) {
        this.tokenError.set(true);
      }
    }, 5000);
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
