import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { NotificacionesAdminService } from '../notificaciones-admin.service';
import { UserService } from '../../socios/user.service';
import { User } from '../../../../core/models/user.model';
import { NotificacionForm } from '../../../../core/models/notificacion.model';

@Component({
  selector: 'app-form-notificacion',
  standalone: true,
  imports: [ReactiveFormsModule, TitleCasePipe],
  templateUrl: './form-notificacion.component.html',
  styleUrl: './form-notificacion.component.scss',
})
export class FormNotificacionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(NotificacionesAdminService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;

  socios = signal<User[]>([]);
  sociosSeleccionados = signal<string[]>([]);
  destinatariosTodos = signal(true);

  tipos = ['torneo', 'cuota', 'aviso', 'resultado', 'otro'] as const;

  form = this.fb.group({
    titulo:          ['', Validators.required],
    tipo:            ['aviso', Validators.required],
    cuerpo:          ['', Validators.required],
    fechaExpiracion: [''],
  });

  async ngOnInit(): Promise<void> {
    const listaSocios = await firstValueFrom(this.userService.getAll());
    this.socios.set(listaSocios.filter(s => s.activo));

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const notif = await this.service.getById(id);
      if (notif) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue({
          titulo:          notif.titulo,
          tipo:            notif.tipo,
          cuerpo:          notif.cuerpo,
          fechaExpiracion: notif.fechaExpiracion ?? '',
        });
        if (notif.destinatarios) {
          this.destinatariosTodos.set(false);
          this.sociosSeleccionados.set(notif.destinatarios);
        }
      }
    }
  }

  toggleDestinatarios(todos: boolean): void {
    this.destinatariosTodos.set(todos);
    if (todos) this.sociosSeleccionados.set([]);
  }

  toggleSocio(id: string): void {
    const actual = this.sociosSeleccionados();
    if (actual.includes(id)) {
      this.sociosSeleccionados.set(actual.filter(s => s !== id));
    } else {
      this.sociosSeleccionados.set([...actual, id]);
    }
  }

  isSocioSeleccionado(id: string): boolean {
    return this.sociosSeleccionados().includes(id);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const val = this.form.value;
    const data: NotificacionForm = {
      titulo:          val.titulo!,
      tipo:            val.tipo as NotificacionForm['tipo'],
      cuerpo:          val.cuerpo!,
      destinatarios:   this.destinatariosTodos() ? null : this.sociosSeleccionados(),
      fechaExpiracion: val.fechaExpiracion || null,
    };

    if (this.isEdit && this.editId) {
      await this.service.actualizar(this.editId, data);
    } else {
      await this.service.crear(data);
    }

    this.router.navigate(['/admin/notificaciones']);
  }

  cancelar(): void {
    this.router.navigate(['/admin/notificaciones']);
  }
}
