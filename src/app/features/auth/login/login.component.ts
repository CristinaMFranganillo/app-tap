import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { User } from '../../../core/models/user.model';

// Mock users para desarrollo — reemplazar con llamada HTTP real
const MOCK_USERS: (User & { password: string; token: string })[] = [
  {
    id: '1', nombre: 'Juan', apellidos: 'García', email: 'admin@test.es',
    numeroSocio: '0001', rol: 'admin', fechaAlta: new Date(), activo: true,
    password: '1234', token: 'mock-admin-token',
  },
  {
    id: '2', nombre: 'María', apellidos: 'López', email: 'mod@test.es',
    numeroSocio: '0002', rol: 'moderador', fechaAlta: new Date(), activo: true,
    password: '1234', token: 'mock-mod-token',
  },
  {
    id: '3', nombre: 'Carlos', apellidos: 'Ruiz', email: 'socio@test.es',
    numeroSocio: '0003', rol: 'socio', fechaAlta: new Date(), activo: true,
    password: '1234', token: 'mock-socio-token',
  },
];

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  error = '';
  loading = false;

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const { email, password } = this.form.value;
    const found = MOCK_USERS.find(u => u.email === email && u.password === password);

    setTimeout(() => {
      this.loading = false;
      if (found) {
        const { password: _, token, ...user } = found;
        this.auth.login(user, token);
        this.router.navigate(['/']);
      } else {
        this.error = 'Email o contraseña incorrectos.';
      }
    }, 400);
  }
}
