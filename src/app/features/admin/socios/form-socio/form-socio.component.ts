import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../user.service';
import { UserRole } from '../../../../core/models/user.model';

@Component({
  selector: 'app-form-socio',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-socio.component.html',
})
export class FormSocioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;

  form = this.fb.group({
    nombre:      ['', Validators.required],
    apellidos:   ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    numeroSocio: ['', Validators.required],
    rol:         ['socio' as UserRole, Validators.required],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const user = this.userService.getById(id);
      if (user) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue(user);
      }
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || !this.editId) return;
    const val = this.form.value;
    await this.userService.update(this.editId, {
      nombre: val.nombre!,
      apellidos: val.apellidos!,
      email: val.email!,
      numeroSocio: val.numeroSocio!,
      rol: val.rol as UserRole,
    });
    this.router.navigate(['/admin/socios']);
  }

  cancel(): void {
    this.router.navigate(['/admin/socios']);
  }
}
