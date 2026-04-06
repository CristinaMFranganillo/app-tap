import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { UserService } from '../../../features/admin/socios/user.service';
import { supabase } from '../../../core/supabase/supabase.client';

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './cambiar-password.component.html',
})
export class CambiarPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private userService = inject(UserService);

  cerrar = output<void>();

  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    password:  ['', [Validators.required, Validators.minLength(6)]],
    confirmar: ['', Validators.required],
  });

  async guardar(): Promise<void> {
    const { password, confirmar } = this.form.value;
    if (password !== confirmar) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const { error } = await supabase.auth.updateUser({ password: password! });
      if (error) throw new Error(error.message);
      await this.marcarLoginDone();
      this.cerrar.emit();
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al cambiar la contraseña.');
    } finally {
      this.saving.set(false);
    }
  }

  async omitir(): Promise<void> {
    await this.marcarLoginDone();
    this.cerrar.emit();
  }

  private async marcarLoginDone(): Promise<void> {
    const id = this.auth.currentUser?.id;
    if (id) await this.userService.setFirstLoginDone(id);
  }
}
