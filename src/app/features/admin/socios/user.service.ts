import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User, UserRole } from '../../../core/models/user.model';

const MOCK_SOCIOS: User[] = [
  { id: '1', nombre: 'Juan', apellidos: 'García', email: 'admin@test.es', numeroSocio: '0001', rol: 'admin', fechaAlta: new Date('2023-01-15'), activo: true },
  { id: '2', nombre: 'María', apellidos: 'López', email: 'mod@test.es', numeroSocio: '0002', rol: 'moderador', fechaAlta: new Date('2023-03-10'), activo: true },
  { id: '3', nombre: 'Carlos', apellidos: 'Ruiz', email: 'socio@test.es', numeroSocio: '0003', rol: 'socio', fechaAlta: new Date('2024-06-01'), activo: false },
  { id: '4', nombre: 'Ana', apellidos: 'Martínez', email: 'ana@test.es', numeroSocio: '0004', rol: 'socio', fechaAlta: new Date('2024-09-20'), activo: true },
];

@Injectable({ providedIn: 'root' })
export class UserService {
  private sociosSubject = new BehaviorSubject<User[]>(MOCK_SOCIOS);
  readonly socios$ = this.sociosSubject.asObservable();

  getAll(): Observable<User[]> {
    return this.socios$;
  }

  getById(id: string): User | undefined {
    return this.sociosSubject.getValue().find(u => u.id === id);
  }

  create(data: Omit<User, 'id'>): void {
    const current = this.sociosSubject.getValue();
    const newUser: User = { ...data, id: Date.now().toString() };
    this.sociosSubject.next([...current, newUser]);
  }

  update(id: string, data: Partial<User>): void {
    const current = this.sociosSubject.getValue();
    this.sociosSubject.next(current.map(u => u.id === id ? { ...u, ...data } : u));
  }

  toggleActivo(id: string): void {
    const current = this.sociosSubject.getValue();
    this.sociosSubject.next(current.map(u => u.id === id ? { ...u, activo: !u.activo } : u));
  }
}
