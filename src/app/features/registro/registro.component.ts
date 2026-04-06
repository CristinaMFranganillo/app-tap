import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SolicitudService } from './solicitud.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './registro.component.html',
})
export class RegistroComponent {
  private fb = inject(FormBuilder);
  private solicitudService = inject(SolicitudService);
  private router = inject(Router);

  form = this.fb.group({
    nombre:    ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    email:     ['', [Validators.required, Validators.email]],
    mensaje:   [''],
  });

  error = signal('');
  loading = signal(false);

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    const { nombre, apellidos, email, mensaje } = this.form.value;

    try {
      await this.solicitudService.create({
        nombre: nombre!,
        apellidos: apellidos!,
        email: email!,
        mensaje: mensaje || undefined,
      });
      // Navegar a confirmación pasando el email como state
      this.router.navigate(['/registro/confirmacion'], {
        state: { email },
      });
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al enviar la solicitud.');
    } finally {
      this.loading.set(false);
    }
  }

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
