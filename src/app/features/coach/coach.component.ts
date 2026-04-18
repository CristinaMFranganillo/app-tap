import { Component, inject, signal, computed, ElementRef, ViewChild, AfterViewChecked, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { CoachService } from './coach.service';
import { MensajeChat } from '../../core/models/coach.model';

@Component({
  selector: 'app-coach',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './coach.component.html',
  styleUrl: './coach.component.scss',
})
export class CoachComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatScroll') private chatScroll!: ElementRef<HTMLDivElement>;

  private auth = inject(AuthService);
  private coachService = inject(CoachService);

  user = computed(() => this.auth.currentUser);

  cargandoInforme = signal(false);
  errorInforme = signal('');
  informe = signal<string | null>(null);
  fechaInforme = signal<string | null>(null);

  informeExpandido = signal(false);

  mensajes = signal<MensajeChat[]>([]);
  enviando = signal(false);
  inputUsuario = '';

  private shouldScrollChat = false;

  async ngOnInit(): Promise<void> {
    const userId = this.auth.currentUser?.id;
    if (!userId) return;

    const ultimo = await this.coachService.getUltimoInforme(userId);
    if (ultimo) {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fechaInforme = new Date(ultimo.createdAt);
      if (fechaInforme > hace24h) {
        this.informe.set(ultimo.contenido);
        this.fechaInforme.set(ultimo.createdAt);
        return;
      }
    }
    await this.actualizarInforme();
  }

  async actualizarInforme(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    this.cargandoInforme.set(true);
    this.errorInforme.set('');
    try {
      const contexto = await this.coachService.recopilarContexto(user.id);
      const respuesta = await this.coachService.generarInforme(user.nombre, contexto);
      this.informe.set(respuesta);
      this.fechaInforme.set(new Date().toISOString());
    } catch (e: any) {
      this.errorInforme.set(e.message ?? 'Error generando el informe');
    } finally {
      this.cargandoInforme.set(false);
    }
  }

  async enviarMensaje(): Promise<void> {
    const texto = this.inputUsuario.trim();
    if (!texto || this.enviando()) return;

    const informe = this.informe();
    if (!informe) return;

    this.mensajes.update(m => [...m, { rol: 'user', texto }]);
    this.inputUsuario = '';
    this.enviando.set(true);
    this.shouldScrollChat = true;

    try {
      const respuesta = await this.coachService.chat(this.mensajes(), informe);
      this.mensajes.update(m => [...m, { rol: 'model', texto: respuesta }]);
    } catch (e: any) {
      this.mensajes.update(m => [...m, { rol: 'model', texto: '¡Vaya! Ha habido un error. Inténtalo de nuevo 🙏' }]);
    } finally {
      this.enviando.set(false);
      this.shouldScrollChat = true;
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarMensaje();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollChat && this.chatScroll) {
      this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
      this.shouldScrollChat = false;
    }
  }

  formatearFecha(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });
  }
}
