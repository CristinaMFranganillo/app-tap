# AppTap — Noticias + Scores + Perfil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar las secciones Noticias (lista + detalle + admin CRUD), Scores/Competiciones (ranking + historial + admin), y Perfil del usuario autenticado.

**Architecture:** Standalone Components con lazy loading. Tres servicios con `BehaviorSubject` sobre datos mock (NewsService, CompeticionService, ScoreService). Vistas de socio (lectura) y admin/moderador (escritura). Componentes compartidos `CardNoticiaComponent` y `CardScoreComponent`. Perfil usa `AuthService.currentUser$` + ScoreService para calcular stats.

**Tech Stack:** Angular 19, Tailwind CSS (paleta brand-yellow/#D4E600, brand-dark/#1A1A1A, surface/#F5F5F5), Bootstrap Icons, Montserrat, RxJS, Angular Signals, ReactiveFormsModule.

---

## File Map

### Nuevos archivos — Servicios
- `src/app/features/noticias/news.service.ts` — getAll(), getById(), getPublicadas(), create(), update(), delete()
- `src/app/features/scores/competicion.service.ts` — getAll(), getActiva(), getById(), create(), update()
- `src/app/features/scores/score.service.ts` — getByCompeticion(), getByUser(), getRanking(), create()

### Nuevos archivos — Shared Components
- `src/app/shared/components/card-noticia/card-noticia.component.ts`
- `src/app/shared/components/card-noticia/card-noticia.component.html`
- `src/app/shared/components/empty-state/empty-state.component.ts`

### Nuevos archivos — Feature Noticias (socio)
- `src/app/features/noticias/lista/lista-noticias.component.ts`
- `src/app/features/noticias/lista/lista-noticias.component.html`
- `src/app/features/noticias/detalle/detalle-noticia.component.ts`
- `src/app/features/noticias/detalle/detalle-noticia.component.html`

### Nuevos archivos — Feature Noticias (admin)
- `src/app/features/admin/noticias/lista-noticias-admin/lista-noticias-admin.component.ts`
- `src/app/features/admin/noticias/lista-noticias-admin/lista-noticias-admin.component.html`
- `src/app/features/admin/noticias/form-noticia/form-noticia.component.ts`
- `src/app/features/admin/noticias/form-noticia/form-noticia.component.html`

### Nuevos archivos — Feature Scores (socio)
- `src/app/features/scores/ranking/scores-ranking.component.ts`
- `src/app/features/scores/ranking/scores-ranking.component.html`
- `src/app/features/scores/historial/scores-historial.component.ts`
- `src/app/features/scores/historial/scores-historial.component.html`

### Nuevos archivos — Feature Scores (admin)
- `src/app/features/admin/scores/form-score/form-score.component.ts`
- `src/app/features/admin/scores/form-score/form-score.component.html`
- `src/app/features/admin/competiciones/form-competicion/form-competicion.component.ts`
- `src/app/features/admin/competiciones/form-competicion/form-competicion.component.html`

### Nuevos archivos — Feature Perfil
- `src/app/features/perfil/perfil.component.html`

### Modificados
- `src/app/features/noticias/noticias.routes.ts` — rutas reales en lugar de placeholder
- `src/app/features/scores/scores.routes.ts` — rutas reales en lugar de placeholder
- `src/app/features/admin/admin.routes.ts` — añadir rutas noticias, scores, competiciones
- `src/app/features/home/home.component.ts` — feed de últimas noticias
- `src/app/features/perfil/perfil.component.ts` — stats reales

---

## Task 1: NewsService con mock data

**Files:**
- Create: `src/app/features/noticias/news.service.ts`

- [ ] **Step 1: Crear `news.service.ts`**

```typescript
// src/app/features/noticias/news.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { News } from '../../core/models/news.model';

const MOCK_NEWS: News[] = [
  {
    id: '1',
    titulo: 'Campeonato Provincial de Foso Olímpico 2026',
    contenido: 'El próximo 15 de mayo celebramos el Campeonato Provincial de Foso Olímpico. La inscripción estará abierta hasta el 30 de abril. No te quedes sin tu plaza, el aforo es limitado. Este año contaremos con la participación de clubes de toda la provincia y esperamos batir el récord de participantes del año pasado.',
    autorId: '1',
    fecha: new Date('2026-04-01'),
    imagenUrl: undefined,
    publicada: true,
  },
  {
    id: '2',
    titulo: 'Nuevas instalaciones en el campo de tiro',
    contenido: 'Hemos renovado las instalaciones del campo con nuevas torres de lanzamiento y sistemas de control automático. Las mejoras estarán disponibles a partir del próximo mes para todos los socios.',
    autorId: '2',
    fecha: new Date('2026-03-20'),
    imagenUrl: undefined,
    publicada: true,
  },
  {
    id: '3',
    titulo: 'Taller de iniciación al tiro deportivo',
    contenido: 'Organizamos un taller de iniciación para socios nuevos y familiares. El taller incluye teoría básica, normas de seguridad y práctica guiada. Plazas limitadas.',
    autorId: '2',
    fecha: new Date('2026-03-10'),
    imagenUrl: undefined,
    publicada: true,
  },
  {
    id: '4',
    titulo: 'Borrador: Actualización reglamento interno',
    contenido: 'Revisión del reglamento interno del club para adaptarlo a la nueva normativa autonómica.',
    autorId: '1',
    fecha: new Date('2026-04-05'),
    imagenUrl: undefined,
    publicada: false,
  },
];

@Injectable({ providedIn: 'root' })
export class NewsService {
  private newsSubject = new BehaviorSubject<News[]>(MOCK_NEWS);
  readonly news$ = this.newsSubject.asObservable();

  getAll(): Observable<News[]> {
    return this.news$;
  }

  getPublicadas(): Observable<News[]> {
    return this.news$.pipe(
      map(news => news.filter(n => n.publicada).sort((a, b) => +b.fecha - +a.fecha))
    );
  }

  getById(id: string): News | undefined {
    return this.newsSubject.getValue().find(n => n.id === id);
  }

  create(data: Omit<News, 'id'>): void {
    const current = this.newsSubject.getValue();
    const newItem: News = { ...data, id: Date.now().toString() };
    this.newsSubject.next([newItem, ...current]);
  }

  update(id: string, data: Partial<News>): void {
    const current = this.newsSubject.getValue();
    this.newsSubject.next(current.map(n => n.id === id ? { ...n, ...data } : n));
  }

  delete(id: string): void {
    this.newsSubject.next(this.newsSubject.getValue().filter(n => n.id !== id));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/noticias/news.service.ts
git commit -m "feat: add NewsService with mock data"
```

---

## Task 2: CompeticionService + ScoreService con mock data

**Files:**
- Create: `src/app/features/scores/competicion.service.ts`
- Create: `src/app/features/scores/score.service.ts`

- [ ] **Step 1: Crear `competicion.service.ts`**

```typescript
// src/app/features/scores/competicion.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Competicion } from '../../core/models/competicion.model';

const MOCK_COMPETICIONES: Competicion[] = [
  { id: '1', nombre: 'Campeonato Provincial 2026', modalidad: 'Foso Olímpico', totalPlatos: 25, fecha: new Date('2026-05-15'), activa: true, creadaPor: '1' },
  { id: '2', nombre: 'Copa Primavera 2026', modalidad: 'Skeet', totalPlatos: 25, fecha: new Date('2026-03-01'), activa: false, creadaPor: '1' },
  { id: '3', nombre: 'Entrenamiento Marzo', modalidad: 'Foso Universal', totalPlatos: 15, fecha: new Date('2026-03-15'), activa: false, creadaPor: '2' },
];

@Injectable({ providedIn: 'root' })
export class CompeticionService {
  private subject = new BehaviorSubject<Competicion[]>(MOCK_COMPETICIONES);
  readonly competiciones$ = this.subject.asObservable();

  getAll(): Observable<Competicion[]> {
    return this.competiciones$;
  }

  getActiva(): Observable<Competicion | undefined> {
    return this.competiciones$.pipe(
      map(list => list.find(c => c.activa))
    );
  }

  getById(id: string): Competicion | undefined {
    return this.subject.getValue().find(c => c.id === id);
  }

  create(data: Omit<Competicion, 'id'>): void {
    const current = this.subject.getValue();
    const newItem: Competicion = { ...data, id: Date.now().toString() };
    this.subject.next([...current, newItem]);
  }

  update(id: string, data: Partial<Competicion>): void {
    const current = this.subject.getValue();
    this.subject.next(current.map(c => c.id === id ? { ...c, ...data } : c));
  }
}
```

- [ ] **Step 2: Crear `score.service.ts`**

```typescript
// src/app/features/scores/score.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Score } from '../../core/models/score.model';

const MOCK_SCORES: Score[] = [
  { id: '1', userId: '3', competicionId: '2', platosRotos: 22, fecha: new Date('2026-03-01'), registradoPor: '2' },
  { id: '2', userId: '4', competicionId: '2', platosRotos: 20, fecha: new Date('2026-03-01'), registradoPor: '2' },
  { id: '3', userId: '1', competicionId: '2', platosRotos: 24, fecha: new Date('2026-03-01'), registradoPor: '2' },
  { id: '4', userId: '3', competicionId: '3', platosRotos: 12, fecha: new Date('2026-03-15'), registradoPor: '2' },
  { id: '5', userId: '4', competicionId: '3', platosRotos: 14, fecha: new Date('2026-03-15'), registradoPor: '2' },
  { id: '6', userId: '1', competicionId: '3', platosRotos: 13, fecha: new Date('2026-03-15'), registradoPor: '2' },
];

export interface RankingEntry {
  userId: string;
  platosRotos: number;
  posicion: number;
}

@Injectable({ providedIn: 'root' })
export class ScoreService {
  private subject = new BehaviorSubject<Score[]>(MOCK_SCORES);
  readonly scores$ = this.subject.asObservable();

  getByCompeticion(competicionId: string): Observable<Score[]> {
    return this.scores$.pipe(
      map(scores => scores.filter(s => s.competicionId === competicionId))
    );
  }

  getByUser(userId: string): Observable<Score[]> {
    return this.scores$.pipe(
      map(scores => scores.filter(s => s.userId === userId).sort((a, b) => +b.fecha - +a.fecha))
    );
  }

  getRanking(competicionId: string): Observable<RankingEntry[]> {
    return this.getByCompeticion(competicionId).pipe(
      map(scores => {
        const sorted = [...scores].sort((a, b) => b.platosRotos - a.platosRotos);
        return sorted.map((s, i) => ({
          userId: s.userId,
          platosRotos: s.platosRotos,
          posicion: i + 1,
        }));
      })
    );
  }

  create(data: Omit<Score, 'id'>): void {
    const current = this.subject.getValue();
    const newScore: Score = { ...data, id: Date.now().toString() };
    this.subject.next([...current, newScore]);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/scores/competicion.service.ts src/app/features/scores/score.service.ts
git commit -m "feat: add CompeticionService and ScoreService with mock data"
```

---

## Task 3: CardNoticiaComponent + EmptyStateComponent

**Files:**
- Create: `src/app/shared/components/card-noticia/card-noticia.component.ts`
- Create: `src/app/shared/components/card-noticia/card-noticia.component.html`
- Create: `src/app/shared/components/empty-state/empty-state.component.ts`

- [ ] **Step 1: Crear `card-noticia.component.ts`**

```typescript
// src/app/shared/components/card-noticia/card-noticia.component.ts
import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { News } from '../../../core/models/news.model';

@Component({
  selector: 'app-card-noticia',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './card-noticia.component.html',
})
export class CardNoticiaComponent {
  @Input({ required: true }) noticia!: News;
}
```

- [ ] **Step 2: Crear `card-noticia.component.html`**

```html
<!-- src/app/shared/components/card-noticia/card-noticia.component.html -->
<div class="bg-white rounded-[14px] shadow-sm overflow-hidden mb-3">
  <!-- Imagen o banner de color -->
  @if (noticia.imagenUrl) {
    <img [src]="noticia.imagenUrl" [alt]="noticia.titulo" class="w-full h-[80px] object-cover" />
  } @else {
    <div class="w-full h-[6px] bg-brand-yellow"></div>
  }

  <div class="px-3 py-2.5">
    <div class="flex items-center justify-between mb-1">
      <span class="text-[7px] font-bold uppercase tracking-[1.5px] text-gray-300">
        {{ noticia.fecha | date:'d MMM yyyy' : '' : 'es' }}
      </span>
      @if (isReciente(noticia.fecha)) {
        <span class="bg-brand-yellow text-brand-dark text-[6.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full">Nuevo</span>
      }
    </div>
    <h3 class="text-[10px] font-bold text-brand-dark leading-tight line-clamp-2">{{ noticia.titulo }}</h3>
    <p class="text-[8.5px] text-gray-400 font-medium mt-1 line-clamp-2 leading-relaxed">{{ noticia.contenido }}</p>
  </div>
</div>
```

- [ ] **Step 3: Añadir método `isReciente` al componente**

Editar `card-noticia.component.ts` y añadir el método dentro de la clase:

```typescript
  isReciente(fecha: Date): boolean {
    const hoy = new Date();
    const diff = hoy.getTime() - new Date(fecha).getTime();
    return diff < 1000 * 60 * 60 * 24 * 7; // menos de 7 días
  }
```

La clase final queda:

```typescript
// src/app/shared/components/card-noticia/card-noticia.component.ts
import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { News } from '../../../core/models/news.model';

@Component({
  selector: 'app-card-noticia',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './card-noticia.component.html',
})
export class CardNoticiaComponent {
  @Input({ required: true }) noticia!: News;

  isReciente(fecha: Date): boolean {
    const hoy = new Date();
    const diff = hoy.getTime() - new Date(fecha).getTime();
    return diff < 1000 * 60 * 60 * 24 * 7;
  }
}
```

- [ ] **Step 4: Crear `empty-state.component.ts`**

```typescript
// src/app/shared/components/empty-state/empty-state.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center py-10 text-center">
      <i class="bi text-[36px] text-gray-200 mb-2" [class]="icon"></i>
      <p class="text-[9px] font-bold text-gray-300 uppercase tracking-wider">{{ mensaje }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon = 'bi-inbox';
  @Input() mensaje = 'Sin resultados';
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/components/card-noticia/ src/app/shared/components/empty-state/
git commit -m "feat: add CardNoticiaComponent and EmptyStateComponent"
```

---

## Task 4: Noticias — lista y detalle (vista socio)

**Files:**
- Create: `src/app/features/noticias/lista/lista-noticias.component.ts`
- Create: `src/app/features/noticias/lista/lista-noticias.component.html`
- Create: `src/app/features/noticias/detalle/detalle-noticia.component.ts`
- Create: `src/app/features/noticias/detalle/detalle-noticia.component.html`
- Modify: `src/app/features/noticias/noticias.routes.ts`

- [ ] **Step 1: Crear `lista-noticias.component.ts`**

```typescript
// src/app/features/noticias/lista/lista-noticias.component.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NewsService } from '../news.service';
import { CardNoticiaComponent } from '../../../shared/components/card-noticia/card-noticia.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-lista-noticias',
  standalone: true,
  imports: [CardNoticiaComponent, EmptyStateComponent],
  templateUrl: './lista-noticias.component.html',
})
export class ListaNoticiasComponent {
  private newsService = inject(NewsService);
  private router = inject(Router);

  noticias = toSignal(this.newsService.getPublicadas(), { initialValue: [] });

  goToDetalle(id: string): void {
    this.router.navigate(['/noticias', id]);
  }
}
```

- [ ] **Step 2: Crear `lista-noticias.component.html`**

```html
<!-- src/app/features/noticias/lista/lista-noticias.component.html -->
<div class="p-3">
  <h2 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-3">Noticias</h2>

  @if (noticias().length === 0) {
    <app-empty-state icon="bi-newspaper" mensaje="No hay noticias publicadas" />
  } @else {
    @for (n of noticias(); track n.id) {
      <button class="w-full text-left" (click)="goToDetalle(n.id)">
        <app-card-noticia [noticia]="n" />
      </button>
    }
  }
</div>
```

- [ ] **Step 3: Crear `detalle-noticia.component.ts`**

```typescript
// src/app/features/noticias/detalle/detalle-noticia.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NewsService } from '../news.service';
import { News } from '../../../core/models/news.model';

@Component({
  selector: 'app-detalle-noticia',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './detalle-noticia.component.html',
})
export class DetalleNoticiaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private newsService = inject(NewsService);

  noticia = signal<News | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.noticia.set(this.newsService.getById(id) ?? null);
    }
    if (!this.noticia()) {
      this.router.navigate(['/noticias']);
    }
  }

  goBack(): void {
    this.router.navigate(['/noticias']);
  }
}
```

- [ ] **Step 4: Crear `detalle-noticia.component.html`**

```html
<!-- src/app/features/noticias/detalle/detalle-noticia.component.html -->
@if (noticia()) {
  <div class="p-3">
    <!-- Botón volver -->
    <button (click)="goBack()" class="flex items-center gap-1 text-[8px] font-bold text-gray-400 mb-3">
      <i class="bi bi-chevron-left text-[11px]"></i>
      Volver
    </button>

    @if (noticia()!.imagenUrl) {
      <img [src]="noticia()!.imagenUrl" [alt]="noticia()!.titulo" class="w-full h-[140px] object-cover rounded-[14px] mb-3" />
    } @else {
      <div class="w-full h-[4px] bg-brand-yellow rounded-full mb-3"></div>
    }

    <p class="text-[7.5px] font-bold text-gray-300 uppercase tracking-wider mb-1">
      {{ noticia()!.fecha | date:'d MMMM yyyy' : '' : 'es' }}
    </p>
    <h1 class="text-[13px] font-black text-brand-dark leading-tight mb-3">{{ noticia()!.titulo }}</h1>
    <p class="text-[9.5px] text-gray-500 font-medium leading-relaxed">{{ noticia()!.contenido }}</p>
  </div>
}
```

- [ ] **Step 5: Actualizar `noticias.routes.ts`**

```typescript
// src/app/features/noticias/noticias.routes.ts
import { Routes } from '@angular/router';

export const noticiasRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lista/lista-noticias.component').then(m => m.ListaNoticiasComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./detalle/detalle-noticia.component').then(m => m.DetalleNoticiaComponent),
  },
];
```

- [ ] **Step 6: Commit**

```bash
git add src/app/features/noticias/
git commit -m "feat: add noticias lista and detalle views for socios"
```

---

## Task 5: HomeComponent — feed de últimas noticias

**Files:**
- Modify: `src/app/features/home/home.component.ts`

- [ ] **Step 1: Actualizar `home.component.ts`**

```typescript
// src/app/features/home/home.component.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NewsService } from '../noticias/news.service';
import { CardNoticiaComponent } from '../../shared/components/card-noticia/card-noticia.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CardNoticiaComponent],
  template: `
    <div class="p-3">
      <h2 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-3">Inicio</h2>

      <p class="text-[8px] font-bold text-gray-300 uppercase tracking-wider mb-2">Últimas noticias</p>

      @for (n of ultimasNoticias(); track n.id) {
        <button class="w-full text-left" (click)="goToNoticia(n.id)">
          <app-card-noticia [noticia]="n" />
        </button>
      }
    </div>
  `,
})
export class HomeComponent {
  private newsService = inject(NewsService);
  private router = inject(Router);

  ultimasNoticias = toSignal(
    this.newsService.getPublicadas().pipe(map(news => news.slice(0, 3))),
    { initialValue: [] }
  );

  goToNoticia(id: string): void {
    this.router.navigate(['/noticias', id]);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/home/home.component.ts
git commit -m "feat: update HomeComponent with latest news feed"
```

---

## Task 6: Admin — Gestión de Noticias (lista + form)

**Files:**
- Create: `src/app/features/admin/noticias/lista-noticias-admin/lista-noticias-admin.component.ts`
- Create: `src/app/features/admin/noticias/lista-noticias-admin/lista-noticias-admin.component.html`
- Create: `src/app/features/admin/noticias/form-noticia/form-noticia.component.ts`
- Create: `src/app/features/admin/noticias/form-noticia/form-noticia.component.html`
- Modify: `src/app/features/admin/admin.routes.ts`

- [ ] **Step 1: Crear `lista-noticias-admin.component.ts`**

```typescript
// src/app/features/admin/noticias/lista-noticias-admin/lista-noticias-admin.component.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NewsService } from '../../../noticias/news.service';
import { News } from '../../../../core/models/news.model';

@Component({
  selector: 'app-lista-noticias-admin',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './lista-noticias-admin.component.html',
})
export class ListaNoticiasAdminComponent {
  private newsService = inject(NewsService);
  private router = inject(Router);

  noticias = toSignal(this.newsService.getAll(), { initialValue: [] as News[] });

  publicadas = () => this.noticias().filter(n => n.publicada);
  borradores = () => this.noticias().filter(n => !n.publicada);

  editar(id: string): void {
    this.router.navigate(['/admin/noticias', id, 'editar']);
  }

  crear(): void {
    this.router.navigate(['/admin/noticias/nueva']);
  }

  eliminar(id: string): void {
    this.newsService.delete(id);
  }

  togglePublicada(noticia: News): void {
    this.newsService.update(noticia.id, { publicada: !noticia.publicada });
  }
}
```

- [ ] **Step 2: Crear `lista-noticias-admin.component.html`**

```html
<!-- src/app/features/admin/noticias/lista-noticias-admin/lista-noticias-admin.component.html -->
<div class="p-3">
  <!-- Publicadas -->
  <h3 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-2">
    Publicadas ({{ publicadas().length }})
  </h3>

  @for (n of publicadas(); track n.id) {
    <div class="flex items-center gap-2 bg-white rounded-[12px] px-3 py-2 mb-2 shadow-sm">
      <div class="flex-1 min-w-0">
        <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ n.titulo }}</p>
        <p class="text-[7.5px] text-gray-400 font-medium">{{ n.fecha | date:'d MMM yyyy' : '' : 'es' }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button (click)="togglePublicada(n)" title="Despublicar" class="text-success">
          <i class="bi bi-eye-fill text-[14px]"></i>
        </button>
        <button (click)="editar(n.id)" class="text-gray-400">
          <i class="bi bi-pencil-fill text-[14px]"></i>
        </button>
        <button (click)="eliminar(n.id)" class="text-danger">
          <i class="bi bi-trash-fill text-[14px]"></i>
        </button>
      </div>
    </div>
  }

  @if (publicadas().length === 0) {
    <p class="text-[9px] text-gray-300 font-medium mb-4">No hay noticias publicadas.</p>
  }

  <!-- Borradores -->
  <h3 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-2 mt-4">
    Borradores ({{ borradores().length }})
  </h3>

  @for (n of borradores(); track n.id) {
    <div class="flex items-center gap-2 bg-white rounded-[12px] px-3 py-2 mb-2 shadow-sm opacity-70">
      <div class="flex-1 min-w-0">
        <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ n.titulo }}</p>
        <p class="text-[7.5px] text-gray-400 font-medium">{{ n.fecha | date:'d MMM yyyy' : '' : 'es' }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button (click)="togglePublicada(n)" title="Publicar" class="text-gray-300">
          <i class="bi bi-eye-slash-fill text-[14px]"></i>
        </button>
        <button (click)="editar(n.id)" class="text-gray-400">
          <i class="bi bi-pencil-fill text-[14px]"></i>
        </button>
        <button (click)="eliminar(n.id)" class="text-danger">
          <i class="bi bi-trash-fill text-[14px]"></i>
        </button>
      </div>
    </div>
  }

  @if (borradores().length === 0) {
    <p class="text-[9px] text-gray-300 font-medium">No hay borradores.</p>
  }
</div>

<!-- FAB -->
<button
  (click)="crear()"
  class="fixed bottom-[60px] right-4 w-[42px] h-[42px] rounded-full bg-brand-yellow text-brand-dark flex items-center justify-center shadow-lg z-40"
>
  <i class="bi bi-plus-lg text-[18px] font-black"></i>
</button>
```

- [ ] **Step 3: Crear `form-noticia.component.ts`**

```typescript
// src/app/features/admin/noticias/form-noticia/form-noticia.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NewsService } from '../../../noticias/news.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-noticia',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-noticia.component.html',
})
export class FormNoticiaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private newsService = inject(NewsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  private editId?: string;

  form = this.fb.group({
    titulo:    ['', Validators.required],
    contenido: ['', Validators.required],
    publicada: [false],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const noticia = this.newsService.getById(id);
      if (noticia) {
        this.isEdit = true;
        this.editId = id;
        this.form.patchValue(noticia);
      }
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    const autorId = this.authService.isAuthenticated()
      ? (this.authService as any).userSubject?.getValue()?.id ?? '1'
      : '1';

    if (this.isEdit && this.editId) {
      this.newsService.update(this.editId, {
        titulo: val.titulo!,
        contenido: val.contenido!,
        publicada: val.publicada ?? false,
      });
    } else {
      this.newsService.create({
        titulo: val.titulo!,
        contenido: val.contenido!,
        publicada: val.publicada ?? false,
        autorId,
        fecha: new Date(),
      });
    }
    this.router.navigate(['/admin/noticias']);
  }

  cancel(): void {
    this.router.navigate(['/admin/noticias']);
  }
}
```

> **Nota sobre `autorId`:** El `AuthService` expone `currentUser$` como Observable. Para obtener el valor sincrónico en el submit sin piping, usar `toSignal` o la estrategia de suscripción en `ngOnInit`. En la implementación real, reemplazar el acceso directo al `userSubject` inyectando una propiedad pública en `AuthService`. Añadir en `auth.service.ts`:
>
> ```typescript
> get currentUser(): User | null {
>   return this.userSubject.getValue();
> }
> ```
>
> Y luego en `form-noticia.component.ts` usar `this.authService.currentUser?.id ?? '1'`.

- [ ] **Step 4: Añadir getter `currentUser` a `AuthService`**

Editar `src/app/core/auth/auth.service.ts` y añadir después de `isAuthenticated()`:

```typescript
  get currentUser(): User | null {
    return this.userSubject.getValue();
  }
```

- [ ] **Step 5: Actualizar `form-noticia.component.ts` para usar el getter**

Reemplazar la línea del `autorId` en `onSubmit()`:

```typescript
    const autorId = this.authService.currentUser?.id ?? '1';
```

Y eliminar la importación de `AuthService` si ya no es necesaria — no, sí se necesita. El import queda igual.

- [ ] **Step 6: Crear `form-noticia.component.html`**

```html
<!-- src/app/features/admin/noticias/form-noticia/form-noticia.component.html -->
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-400">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">
      {{ isEdit ? 'Editar noticia' : 'Nueva noticia' }}
    </h2>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3">
    <!-- Título -->
    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Título</label>
      <input
        formControlName="titulo"
        type="text"
        placeholder="Título de la noticia"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm placeholder-gray-300"
      />
    </div>

    <!-- Contenido -->
    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Contenido</label>
      <textarea
        formControlName="contenido"
        rows="6"
        placeholder="Escribe el contenido de la noticia..."
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm placeholder-gray-300 resize-none"
      ></textarea>
    </div>

    <!-- Publicada -->
    <label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" formControlName="publicada" class="accent-brand-yellow w-3.5 h-3.5" />
      <span class="text-[9px] font-semibold text-brand-dark">Publicar inmediatamente</span>
    </label>

    <!-- Botones -->
    <div class="flex gap-2 pt-1">
      <button
        type="button"
        (click)="cancel()"
        class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400"
      >
        Cancelar
      </button>
      <button
        type="submit"
        [disabled]="form.invalid"
        class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50"
      >
        {{ isEdit ? 'Guardar cambios' : 'Crear noticia' }}
      </button>
    </div>
  </form>
</div>
```

- [ ] **Step 7: Actualizar `admin.routes.ts`**

```typescript
// src/app/features/admin/admin.routes.ts
import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const adminRoutes: Routes = [
  // Socios
  {
    path: 'socios',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/lista-socios/lista-socios.component').then(m => m.ListaSociosComponent),
  },
  {
    path: 'socios/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  {
    path: 'socios/:id',
    canActivate: [roleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./socios/form-socio/form-socio.component').then(m => m.FormSocioComponent),
  },
  // Noticias
  {
    path: 'noticias',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/lista-noticias-admin/lista-noticias-admin.component').then(m => m.ListaNoticiasAdminComponent),
  },
  {
    path: 'noticias/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  {
    path: 'noticias/:id/editar',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./noticias/form-noticia/form-noticia.component').then(m => m.FormNoticiaComponent),
  },
  // Scores
  {
    path: 'scores/nuevo',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./scores/form-score/form-score.component').then(m => m.FormScoreComponent),
  },
  // Competiciones
  {
    path: 'competiciones/nueva',
    canActivate: [roleGuard],
    data: { roles: ['admin', 'moderador'] },
    loadComponent: () =>
      import('./competiciones/form-competicion/form-competicion.component').then(m => m.FormCompeticionComponent),
  },
];
```

- [ ] **Step 8: Commit**

```bash
git add src/app/features/admin/noticias/ src/app/features/admin/admin.routes.ts src/app/core/auth/auth.service.ts
git commit -m "feat: add admin noticias CRUD and update routes"
```

---

## Task 7: Scores — Ranking por competición (vista socio)

**Files:**
- Create: `src/app/features/scores/ranking/scores-ranking.component.ts`
- Create: `src/app/features/scores/ranking/scores-ranking.component.html`
- Modify: `src/app/features/scores/scores.routes.ts`

- [ ] **Step 1: Crear `scores-ranking.component.ts`**

```typescript
// src/app/features/scores/ranking/scores-ranking.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { ScoreService, RankingEntry } from '../score.service';
import { CompeticionService } from '../competicion.service';
import { UserService } from '../../admin/socios/user.service';
import { Competicion } from '../../../core/models/competicion.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-scores-ranking',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './scores-ranking.component.html',
})
export class ScoresRankingComponent {
  private competicionService = inject(CompeticionService);
  private scoreService = inject(ScoreService);
  private userService = inject(UserService);

  competiciones = toSignal(this.competicionService.getAll(), { initialValue: [] as Competicion[] });
  selectedId = signal<string>('');

  ranking = toSignal(
    toObservable(this.selectedId).pipe(
      switchMap(id => this.scoreService.getRanking(id))
    ),
    { initialValue: [] as RankingEntry[] }
  );

  ngOnInit(): void {
    // Seleccionar primera competición al cargar
    const comp = this.competicionService.getById(this.competiciones()[0]?.id ?? '');
    if (this.competiciones().length > 0) {
      this.selectedId.set(this.competiciones()[0].id);
    }
  }

  selectCompeticion(id: string): void {
    this.selectedId.set(id);
  }

  getCompeticionNombre(): string {
    return this.competiciones().find(c => c.id === this.selectedId())?.nombre ?? '';
  }

  getUserNombre(userId: string): string {
    const u = this.userService.getById(userId);
    return u ? `${u.nombre} ${u.apellidos}` : 'Desconocido';
  }

  getUserApellidos(userId: string): string {
    return this.userService.getById(userId)?.apellidos ?? '';
  }

  getMedalIcon(posicion: number): string {
    if (posicion === 1) return '🥇';
    if (posicion === 2) return '🥈';
    if (posicion === 3) return '🥉';
    return `${posicion}º`;
  }
}
```

- [ ] **Step 2: Crear `scores-ranking.component.html`**

```html
<!-- src/app/features/scores/ranking/scores-ranking.component.html -->
<div class="p-3">
  <h2 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-3">Ranking</h2>

  <!-- Selector de competición -->
  <div class="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
    @for (c of competiciones(); track c.id) {
      <button
        (click)="selectCompeticion(c.id)"
        class="flex-shrink-0 px-3 py-1.5 rounded-full text-[8px] font-bold transition-colors"
        [class]="c.id === selectedId()
          ? 'bg-brand-dark text-white'
          : 'bg-white text-gray-400 shadow-sm'"
      >
        {{ c.nombre }}
      </button>
    }
  </div>

  <!-- Tabla ranking -->
  @if (ranking().length === 0) {
    <div class="flex flex-col items-center justify-center py-10 text-center">
      <i class="bi bi-trophy text-[36px] text-gray-200 mb-2"></i>
      <p class="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Sin resultados</p>
    </div>
  } @else {
    @for (entry of ranking(); track entry.userId) {
      <div class="flex items-center gap-3 bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm"
           [class]="entry.posicion <= 3 ? 'border-l-[3px] border-brand-yellow' : ''">
        <span class="text-[14px] w-6 text-center">{{ getMedalIcon(entry.posicion) }}</span>
        <app-avatar
          [nombre]="getUserNombre(entry.userId)"
          [apellidos]="getUserApellidos(entry.userId)"
          [size]="32"
        />
        <div class="flex-1 min-w-0">
          <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ getUserNombre(entry.userId) }}</p>
        </div>
        <div class="text-right">
          <p class="text-[13px] font-black text-brand-dark">{{ entry.platosRotos }}</p>
          <p class="text-[7px] font-bold text-gray-300 uppercase tracking-wide">platos</p>
        </div>
      </div>
    }
  }
</div>
```

- [ ] **Step 3: Actualizar `scores.routes.ts`**

```typescript
// src/app/features/scores/scores.routes.ts
import { Routes } from '@angular/router';

export const scoresRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./ranking/scores-ranking.component').then(m => m.ScoresRankingComponent),
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('./historial/scores-historial.component').then(m => m.ScoresHistorialComponent),
  },
];
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/scores/ranking/ src/app/features/scores/scores.routes.ts
git commit -m "feat: add scores ranking view for socios"
```

---

## Task 8: Scores — Historial personal (vista socio)

**Files:**
- Create: `src/app/features/scores/historial/scores-historial.component.ts`
- Create: `src/app/features/scores/historial/scores-historial.component.html`

- [ ] **Step 1: Crear `scores-historial.component.ts`**

```typescript
// src/app/features/scores/historial/scores-historial.component.ts
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ScoreService } from '../score.service';
import { CompeticionService } from '../competicion.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Score } from '../../../core/models/score.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-scores-historial',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './scores-historial.component.html',
})
export class ScoresHistorialComponent {
  private authService = inject(AuthService);
  private scoreService = inject(ScoreService);
  private competicionService = inject(CompeticionService);

  scores = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(user => this.scoreService.getByUser(user?.id ?? ''))
    ),
    { initialValue: [] as Score[] }
  );

  getCompeticionNombre(competicionId: string): string {
    return this.competicionService.getById(competicionId)?.nombre ?? 'Competición';
  }

  getCompeticionTotal(competicionId: string): number {
    return this.competicionService.getById(competicionId)?.totalPlatos ?? 0;
  }

  getPorcentaje(platosRotos: number, competicionId: string): number {
    const total = this.getCompeticionTotal(competicionId);
    return total > 0 ? Math.round((platosRotos / total) * 100) : 0;
  }
}
```

- [ ] **Step 2: Crear `scores-historial.component.html`**

```html
<!-- src/app/features/scores/historial/scores-historial.component.html -->
<div class="p-3">
  <h2 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-3">Mi Historial</h2>

  @if (scores().length === 0) {
    <app-empty-state icon="bi-trophy" mensaje="Sin resultados registrados" />
  } @else {
    @for (score of scores(); track score.id) {
      <div class="bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm">
        <div class="flex items-start justify-between mb-1.5">
          <div class="flex-1 min-w-0">
            <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ getCompeticionNombre(score.competicionId) }}</p>
            <p class="text-[7.5px] text-gray-300 font-medium">{{ score.fecha | date:'d MMM yyyy' : '' : 'es' }}</p>
          </div>
          <div class="text-right ml-2">
            <p class="text-[14px] font-black text-brand-dark">{{ score.platosRotos }}<span class="text-[9px] text-gray-300 font-semibold">/{{ getCompeticionTotal(score.competicionId) }}</span></p>
          </div>
        </div>
        <!-- Barra de progreso -->
        <div class="w-full h-[3px] bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-brand-yellow rounded-full transition-all"
            [style.width.%]="getPorcentaje(score.platosRotos, score.competicionId)"
          ></div>
        </div>
        <p class="text-[7px] font-bold text-gray-300 text-right mt-0.5">{{ getPorcentaje(score.platosRotos, score.competicionId) }}%</p>
      </div>
    }
  }
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/scores/historial/
git commit -m "feat: add scores historial personal view"
```

---

## Task 9: Admin — Registrar Score

**Files:**
- Create: `src/app/features/admin/scores/form-score/form-score.component.ts`
- Create: `src/app/features/admin/scores/form-score/form-score.component.html`

- [ ] **Step 1: Crear `form-score.component.ts`**

```typescript
// src/app/features/admin/scores/form-score/form-score.component.ts
import { Component, inject, signal } from '@angular/core';
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

  onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    this.scoreService.create({
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
```

- [ ] **Step 2: Crear `form-score.component.html`**

```html
<!-- src/app/features/admin/scores/form-score/form-score.component.html -->
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-400">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">Registrar Score</h2>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3">
    <!-- Competición -->
    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Competición</label>
      <select
        formControlName="competicionId"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
      >
        <option value="">Selecciona una competición</option>
        @for (c of competiciones(); track c.id) {
          <option [value]="c.id">{{ c.nombre }} — {{ c.modalidad }}</option>
        }
      </select>
    </div>

    <!-- Socio -->
    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Socio</label>
      <select
        formControlName="userId"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
      >
        <option value="">Selecciona un socio</option>
        @for (s of socios(); track s.id) {
          <option [value]="s.id">{{ s.nombre }} {{ s.apellidos }} (#{{ s.numeroSocio }})</option>
        }
      </select>
    </div>

    <!-- Platos rotos -->
    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">
        Platos rotos (máx. {{ maxPlatos() }})
      </label>
      <input
        formControlName="platosRotos"
        type="number"
        [max]="maxPlatos()"
        min="0"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
      />
    </div>

    <!-- Botones -->
    <div class="flex gap-2 pt-1">
      <button
        type="button"
        (click)="cancel()"
        class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400"
      >
        Cancelar
      </button>
      <button
        type="submit"
        [disabled]="form.invalid"
        class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50"
      >
        Registrar
      </button>
    </div>
  </form>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/scores/
git commit -m "feat: add admin form-score to register competition results"
```

---

## Task 10: Admin — Crear Competición

**Files:**
- Create: `src/app/features/admin/competiciones/form-competicion/form-competicion.component.ts`
- Create: `src/app/features/admin/competiciones/form-competicion/form-competicion.component.html`

- [ ] **Step 1: Crear `form-competicion.component.ts`**

```typescript
// src/app/features/admin/competiciones/form-competicion/form-competicion.component.ts
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CompeticionService } from '../../../scores/competicion.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-form-competicion',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-competicion.component.html',
})
export class FormCompeticionComponent {
  private fb = inject(FormBuilder);
  private competicionService = inject(CompeticionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    nombre:      ['', Validators.required],
    modalidad:   ['', Validators.required],
    totalPlatos: [25, [Validators.required, Validators.min(1)]],
    fecha:       ['', Validators.required],
    activa:      [false],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    this.competicionService.create({
      nombre: val.nombre!,
      modalidad: val.modalidad!,
      totalPlatos: Number(val.totalPlatos),
      fecha: new Date(val.fecha!),
      activa: val.activa ?? false,
      creadaPor: this.authService.currentUser?.id ?? '1',
    });
    this.router.navigate(['/scores']);
  }

  cancel(): void {
    this.router.navigate(['/scores']);
  }
}
```

- [ ] **Step 2: Crear `form-competicion.component.html`**

```html
<!-- src/app/features/admin/competiciones/form-competicion/form-competicion.component.html -->
<div class="p-3">
  <div class="flex items-center gap-2 mb-4">
    <button (click)="cancel()" class="text-gray-400">
      <i class="bi bi-chevron-left text-[15px]"></i>
    </button>
    <h2 class="text-[11px] font-bold text-brand-dark">Nueva Competición</h2>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3">
    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Nombre</label>
      <input
        formControlName="nombre"
        type="text"
        placeholder="Campeonato Provincial 2026"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm placeholder-gray-300"
      />
    </div>

    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Modalidad</label>
      <input
        formControlName="modalidad"
        type="text"
        placeholder="Foso Olímpico, Skeet, Foso Universal..."
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm placeholder-gray-300"
      />
    </div>

    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Total de platos</label>
      <input
        formControlName="totalPlatos"
        type="number"
        min="1"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
      />
    </div>

    <div>
      <label class="block text-[7.5px] font-bold text-gray-300 uppercase tracking-wide mb-1">Fecha</label>
      <input
        formControlName="fecha"
        type="date"
        class="w-full bg-white rounded-[10px] px-3 py-2 text-[10px] font-medium text-brand-dark outline-none shadow-sm"
      />
    </div>

    <label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" formControlName="activa" class="accent-brand-yellow w-3.5 h-3.5" />
      <span class="text-[9px] font-semibold text-brand-dark">Marcar como competición activa</span>
    </label>

    <div class="flex gap-2 pt-1">
      <button
        type="button"
        (click)="cancel()"
        class="flex-1 py-2.5 rounded-[12px] border border-gray-200 text-[9px] font-bold text-gray-400"
      >
        Cancelar
      </button>
      <button
        type="submit"
        [disabled]="form.invalid"
        class="flex-1 py-2.5 rounded-[12px] bg-brand-yellow text-brand-dark text-[9px] font-bold disabled:opacity-50"
      >
        Crear competición
      </button>
    </div>
  </form>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/admin/competiciones/
git commit -m "feat: add admin form-competicion"
```

---

## Task 11: Perfil del usuario

**Files:**
- Modify: `src/app/features/perfil/perfil.component.ts`
- Create: `src/app/features/perfil/perfil.component.html`

- [ ] **Step 1: Actualizar `perfil.component.ts`**

```typescript
// src/app/features/perfil/perfil.component.ts
import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map, combineLatest } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ScoreService } from '../scores/score.service';
import { CompeticionService } from '../scores/competicion.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { Score } from '../../core/models/score.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [AvatarComponent, DatePipe, EmptyStateComponent],
  templateUrl: './perfil.component.html',
})
export class PerfilComponent {
  private authService = inject(AuthService);
  private scoreService = inject(ScoreService);
  private competicionService = inject(CompeticionService);
  private router = inject(Router);

  user = toSignal(this.authService.currentUser$, { initialValue: null });

  scores = toSignal(
    this.authService.currentUser$.pipe(
      switchMap(u => this.scoreService.getByUser(u?.id ?? ''))
    ),
    { initialValue: [] as Score[] }
  );

  totalCompeticiones = computed(() => new Set(this.scores().map(s => s.competicionId)).size);

  mediaPlatos = computed(() => {
    const list = this.scores();
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, s) => acc + s.platosRotos, 0);
    return Math.round(sum / list.length);
  });

  podios = computed(() =>
    // Un podio = estar en top 3 de al menos una competición (simplificado: score >= 20)
    this.scores().filter(s => s.platosRotos >= 20).length
  );

  getCompeticionNombre(competicionId: string): string {
    return this.competicionService.getById(competicionId)?.nombre ?? 'Competición';
  }

  getCompeticionTotal(competicionId: string): number {
    return this.competicionService.getById(competicionId)?.totalPlatos ?? 25;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 2: Crear `perfil.component.html`**

```html
<!-- src/app/features/perfil/perfil.component.html -->
<div>
  <!-- Hero -->
  <div class="bg-brand-dark px-4 pt-4 pb-6 flex flex-col items-center">
    <app-avatar
      [nombre]="user()?.nombre ?? ''"
      [apellidos]="user()?.apellidos ?? ''"
      [avatarUrl]="user()?.avatarUrl"
      [size]="64"
    />
    <h2 class="text-white font-bold text-[13px] mt-2">
      {{ user()?.nombre }} {{ user()?.apellidos }}
    </h2>
    <p class="text-brand-yellow font-bold text-[8px] uppercase tracking-wider">
      {{ user()?.rol }} · #{{ user()?.numeroSocio }}
    </p>
  </div>

  <!-- Stats -->
  <div class="flex mx-3 -mt-4 bg-white rounded-[14px] shadow-sm overflow-hidden">
    <div class="flex-1 flex flex-col items-center py-3 border-r border-gray-100">
      <p class="text-[17px] font-black text-brand-dark">{{ totalCompeticiones() }}</p>
      <p class="text-[7px] font-bold text-gray-300 uppercase tracking-wide">Competiciones</p>
    </div>
    <div class="flex-1 flex flex-col items-center py-3 border-r border-gray-100">
      <p class="text-[17px] font-black text-brand-dark">{{ mediaPlatos() }}</p>
      <p class="text-[7px] font-bold text-gray-300 uppercase tracking-wide">Media platos</p>
    </div>
    <div class="flex-1 flex flex-col items-center py-3">
      <p class="text-[17px] font-black text-brand-dark">{{ podios() }}</p>
      <p class="text-[7px] font-bold text-gray-300 uppercase tracking-wide">Podios</p>
    </div>
  </div>

  <!-- Historial -->
  <div class="p-3 mt-2">
    <h3 class="text-[9px] font-bold uppercase tracking-[1.5px] text-brand-dark mb-2">Mis Resultados</h3>

    @if (scores().length === 0) {
      <app-empty-state icon="bi-trophy" mensaje="Sin resultados registrados" />
    } @else {
      @for (score of scores(); track score.id) {
        <div class="bg-white rounded-[12px] px-3 py-2.5 mb-2 shadow-sm flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-[9.5px] font-bold text-brand-dark truncate">{{ getCompeticionNombre(score.competicionId) }}</p>
            <p class="text-[7.5px] text-gray-300 font-medium">{{ score.fecha | date:'d MMM yyyy' : '' : 'es' }}</p>
          </div>
          <div class="text-right">
            <p class="text-[13px] font-black text-brand-dark">
              {{ score.platosRotos }}<span class="text-[8px] text-gray-300 font-semibold">/{{ getCompeticionTotal(score.competicionId) }}</span>
            </p>
          </div>
        </div>
      }
    }
  </div>

  <!-- Logout -->
  <div class="px-3 pb-4">
    <button
      (click)="logout()"
      class="w-full py-2.5 rounded-[12px] border border-danger text-danger text-[9px] font-bold"
    >
      <i class="bi bi-box-arrow-right mr-1"></i>
      Cerrar sesión
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/perfil/
git commit -m "feat: implement perfil with user stats and score history"
```

---

## Task 12: Verificación final — build y revisión visual

- [ ] **Step 1: Verificar que compila sin errores**

```bash
cd C:/Users/cristina.mf/Desktop/tap/appTap
ng build --configuration development 2>&1 | tail -20
```

Expected: sin errores de compilación TypeScript.

- [ ] **Step 2: Levantar servidor de desarrollo**

```bash
ng serve --open
```

Navegar a `http://localhost:4200` y verificar:
- Login con credenciales mock (admin@test.es / cualquier contraseña)
- Home muestra últimas 3 noticias
- `/noticias` muestra lista de cards
- `/noticias/1` muestra detalle
- `/scores` muestra ranking con selector de competición
- `/scores/historial` muestra historial personal
- `/perfil` muestra hero con stats y botón de logout
- `/admin/noticias` muestra gestión de noticias (solo admin/moderador)
- `/admin/scores/nuevo` muestra formulario de registro de score

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: complete noticias, scores, perfil implementation"
```
