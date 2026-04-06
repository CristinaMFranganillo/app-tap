import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ScoreService } from '../../../scores/score.service';
import { CompeticionService } from '../../../scores/competicion.service';
import { UserService } from '../../socios/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { User } from '../../../../core/models/user.model';
import { Competicion } from '../../../../core/models/competicion.model';

@Component({
  selector: 'app-form-score',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-score.component.html',
})
export class FormScoreComponent {
  private fb = inject(FormBuilder);
  private scoreService = inject(ScoreService);
  private competicionService = inject(CompeticionService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  socios = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

  form = this.fb.group({
    competicionId: ['', Validators.required],
    userId:        ['', Validators.required],
    platosRotos:   [0, [Validators.required, Validators.min(0)]],
  });

  maxPlatos(): number {
    const id = this.form.value.competicionId;
    return this.competicionService.getById(id ?? '')?.totalPlatos ?? 25;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const val = this.form.value;
    await this.scoreService.create({
      competicionId: val.competicionId!,
      userId: val.userId!,
      platosRotos: Number(val.platosRotos),
      fecha: new Date(),
      registradoPor: this.authService.currentUser?.id ?? '1',
    });
    this.router.navigate(['/scores']);
  }

  cancel(): void {
    this.router.navigate(['/scores']);
  }
}
