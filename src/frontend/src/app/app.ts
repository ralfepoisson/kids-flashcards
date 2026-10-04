import { Component, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { Api } from './api';
import { AuthUser, CardInput, Flashcard, FlashcardSet, SetDetail } from './models';
import { InterfaceLanguage, MessageKey } from './language';
import { Dialog } from './dialog';
import { navigate, shuffled } from './practice';

@Component({
  selector: 'app-root',
  imports: [FormsModule, Dialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  readonly i18n = inject(InterfaceLanguage);
  t(key: MessageKey, values: Record<string, string | number> = {}) {
    return this.i18n.t(key, values);
  }
  private api = inject(Api);
  pictureUrl(content: string) {
    return this.api.pictureUrl(content);
  }
  private toast = inject(ToastrService);
  private location = inject(Location);
  private destroyRef = inject(DestroyRef);
  sets = signal<FlashcardSet[]>([]);
  user = signal<AuthUser | null>(null);
  authBusy = signal(true);
  selected = signal<SetDetail | null>(null);
  loading = signal(true);
  failure = signal(false);
  busy = signal(false);
  uploading = signal(false);
  mode = signal<'edit' | 'practice'>('edit');
  editor = signal<'set' | 'card' | null>(null);
  deleteTarget = signal<{ kind: 'set' | 'card'; id: string; name: string } | null>(null);
  editingId: string | null = null;
  setDraft = { name: '', description: '', is_public: false };
  cardDraft: CardInput = this.blankCard();
  search = signal('');
  round = signal<Flashcard[]>([]);
  index = signal(0);
  flipped = signal(false);
  practiceCardVersion = signal(0);
  private selectionRequest = 0;
  private sessionRevision = 0;
  ngOnInit() {
    const subscription = this.location.subscribe(() => void this.restoreUrl());
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
    void this.initialize();
  }
  private async initialize() {
    const path = this.location.path();
    if (path.split('?')[0] === '/auth/callback') {
      const code = new URLSearchParams(path.split('?')[1] ?? '').get('handoff_code');
      // Remove the one-use code from browser history before any HTTP request.
      this.location.replaceState('/');
      let pending = false;
      let returnPath = '/';
      try {
        pending = sessionStorage.getItem('kids-flashcards-login-pending') === '1';
        returnPath = sessionStorage.getItem('kids-flashcards-login-return') ?? '/';
        sessionStorage.removeItem('kids-flashcards-login-pending');
        sessionStorage.removeItem('kids-flashcards-login-return');
      } catch {
        /* Login still fails visibly if its intent cannot be checked. */
      }
      try {
        if (!pending || !code) throw new Error('Missing login intent or code');
        const config = await this.api.authConfig();
        const exchanged = await this.api.exchangeCode(config.exchangeUrl, code);
        if (!exchanged.token) throw new Error('Missing token');
        await this.api.session(exchanged.token);
        if (/^\/set\/[^/?#]+\/(practice|edit)$/.test(returnPath)) this.writeUrl(returnPath, true);
      } catch {
        this.toast.error(this.t('loginFailed'), this.t('errorTitle'));
      }
    }
    try {
      const session = await this.api.me();
      this.user.set(session.authenticated ? session.user : null);
    } catch {
      this.toast.error(this.t('sessionUnavailable'), this.t('errorTitle'));
    } finally {
      this.authBusy.set(false);
    }
    await this.load();
  }
  async login() {
    if (this.authBusy()) return;
    this.authBusy.set(true);
    try {
      const config = await this.api.authConfig();
      sessionStorage.setItem('kids-flashcards-login-return', this.location.path() || '/');
      sessionStorage.setItem('kids-flashcards-login-pending', '1');
      window.location.assign(config.signInUrl);
    } catch {
      try {
        sessionStorage.removeItem('kids-flashcards-login-pending');
        sessionStorage.removeItem('kids-flashcards-login-return');
      } catch {
        /* No credentials are stored here. */
      }
      this.toast.error(this.t('loginUnavailable'), this.t('errorTitle'));
      this.authBusy.set(false);
    }
  }
  async logout() {
    if (this.authBusy()) return;
    this.authBusy.set(true);
    this.clearSession();
    try {
      await this.api.logout();
      await this.load();
    } catch {
      this.toast.error(this.t('logoutFailed'), this.t('errorTitle'));
    } finally {
      this.authBusy.set(false);
    }
  }
  canEdit(set: FlashcardSet | null = this.selected()) {
    return !!this.user() && !!set?.can_edit && !this.authBusy();
  }
  private clearSession() {
    ++this.sessionRevision;
    this.user.set(null);
    this.sets.set([]);
    this.setDraft = { name: '', description: '', is_public: false };
    this.cardDraft = this.blankCard();
    this.editingId = null;
    this.search.set('');
    this.library();
  }
  blankCard(): CardInput {
    return {
      front_type: 'text',
      front_content: '',
      front_instruction: '',
      back_type: 'text',
      back_content: '',
      back_explanation: '',
    };
  }
  filteredSets() {
    const query = this.search().toLowerCase();
    return this.sets().filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(query));
  }
  totalCards() {
    return this.sets().reduce((n, s) => n + s.card_count, 0);
  }
  current() {
    return this.round()[this.index()];
  }
  async load() {
    const selection = this.selectionRequest;
    const revision = this.sessionRevision;
    this.loading.set(true);
    this.failure.set(false);
    try {
      const sets = await this.api.sets();
      if (revision !== this.sessionRevision) return;
      this.sets.set(sets);
      if (selection === this.selectionRequest && this.location.path()) await this.restoreUrl();
    } catch (e) {
      this.failure.set(true);
      await this.error(e);
    } finally {
      this.loading.set(false);
    }
  }
  async selectSet(set: FlashcardSet) {
    if (this.busy()) return;
    this.writeUrl(`/set/${encodeURIComponent(set.id)}/practice`);
    await this.loadSet(set.id, 'practice');
  }
  private async loadSet(id: string, mode: 'edit' | 'practice') {
    const request = ++this.selectionRequest;
    this.loading.set(true);
    this.failure.set(false);
    this.selected.set(null);
    this.round.set([]);
    try {
      const detail = await this.api.detail(id);
      if (request !== this.selectionRequest) return;
      this.selected.set(detail);
      const allowedMode = mode === 'edit' && !this.canEdit(detail) ? 'practice' : mode;
      this.mode.set(allowedMode);
      this.writeUrl(`/set/${encodeURIComponent(id)}/${allowedMode}`, true);
      this.newRound();
    } catch (e) {
      if (request === this.selectionRequest) {
        this.failure.set(true);
        await this.error(e);
      }
    } finally {
      if (request === this.selectionRequest) this.loading.set(false);
    }
  }
  library() {
    ++this.selectionRequest;
    this.selected.set(null);
    this.round.set([]);
    this.loading.set(false);
    this.failure.set(false);
    this.mode.set('edit');
    this.editor.set(null);
    this.deleteTarget.set(null);
    this.writeUrl('/');
  }
  switchMode(mode: 'edit' | 'practice') {
    if (mode === 'edit' && !this.canEdit()) return;
    this.mode.set(mode);
    if (mode === 'practice') this.newRound();
    const set = this.selected();
    if (set) this.writeUrl(`/set/${encodeURIComponent(set.id)}/${mode}`);
  }
  private writeUrl(path: string, replace = false) {
    if ((this.location.path() || '/') === path) return;
    if (replace) this.location.replaceState(path);
    else this.location.go(path);
  }
  private async restoreUrl() {
    const path = this.location.path().split('?')[0];
    if (!path || path === '/') {
      if (this.selected() || this.loading()) this.library();
      return;
    }
    const match = /^\/set\/([^/]+)(?:\/(practice|edit))?\/?$/.exec(path);
    if (!match) {
      this.writeUrl('/', true);
      this.library();
      return;
    }
    let id: string;
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      this.writeUrl('/', true);
      this.library();
      return;
    }
    const mode = match[2] === 'edit' ? 'edit' : 'practice';
    this.writeUrl(`/set/${encodeURIComponent(id)}/${mode}`, true);
    this.editor.set(null);
    this.deleteTarget.set(null);
    if (this.selected()?.id === id) {
      ++this.selectionRequest;
      const allowedMode = mode === 'edit' && !this.canEdit() ? 'practice' : mode;
      this.mode.set(allowedMode);
      this.writeUrl(`/set/${encodeURIComponent(id)}/${allowedMode}`, true);
      if (mode === 'practice') this.newRound();
    } else {
      await this.loadSet(id, mode);
    }
  }
  newRound() {
    this.round.set(shuffled(this.selected()?.cards ?? []));
    this.index.set(0);
    this.flipped.set(false);
    this.practiceCardVersion.update((v) => v + 1);
  }
  flip() {
    this.flipped.update((v) => !v);
  }
  move(direction: number) {
    this.index.set(navigate(this.index(), direction, this.round().length));
    this.flipped.set(false);
    this.practiceCardVersion.update((v) => v + 1);
  }
  @HostListener('document:keydown', ['$event'])
  keyboard(event: KeyboardEvent) {
    if (this.mode() !== 'practice' || this.editor() || this.deleteTarget() || !this.current())
      return;
    const target = event.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.move(1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.move(-1);
    }
    if (event.key === ' ' && target.tagName !== 'BUTTON') {
      event.preventDefault();
      this.flipped.update((v) => !v);
    }
  }
  openSet(set?: FlashcardSet) {
    if (!this.user() || this.authBusy() || (set && !this.canEdit(set))) return;
    this.editingId = set?.id ?? null;
    this.setDraft = {
      name: set?.name ?? '',
      description: set?.description ?? '',
      is_public: set?.is_public ?? false,
    };
    this.editor.set('set');
  }
  openCard(card?: Flashcard) {
    if (!this.canEdit()) return;
    this.editingId = card?.id ?? null;
    this.cardDraft = card ? { ...card } : this.blankCard();
    this.editor.set('card');
  }
  closeEditor() {
    if (!this.busy() && !this.uploading()) this.editor.set(null);
  }
  async saveSet() {
    if (!this.user() || this.authBusy() || this.busy() || !this.setDraft.name.trim()) return;
    if (
      this.editingId &&
      !this.sets().some((set) => set.id === this.editingId && set.can_edit) &&
      !(this.selected()?.id === this.editingId && this.canEdit())
    )
      return;
    const revision = this.sessionRevision;
    const creating = this.editingId === null;
    await this.mutate(async () => {
      const set = await this.api.saveSet(this.editingId, {
        name: this.setDraft.name.trim(),
        description: this.setDraft.description.trim(),
        is_public: this.setDraft.is_public,
      });
      if (revision !== this.sessionRevision) return;
      this.editingId = set.id;
      this.sets.update((sets) => [...sets.filter((item) => item.id !== set.id), set]);
      const sets = await this.api.sets();
      if (revision !== this.sessionRevision) return;
      this.sets.set(sets);
      const detail = await this.api.detail(set.id);
      if (revision !== this.sessionRevision) return;
      this.selected.set(detail);
      if (creating) this.mode.set('edit');
      this.newRound();
      this.writeUrl(`/set/${encodeURIComponent(set.id)}/${this.mode()}`);
      this.editor.set(null);
      this.toast.success(this.t('setReady'), this.t('setSaved'));
    });
  }
  async saveCard() {
    const set = this.selected();
    if (!set || !this.canEdit(set) || this.busy() || this.uploading()) return;
    const revision = this.sessionRevision;
    await this.mutate(async () => {
      const d = this.cardDraft;
      const saved = await this.api.saveCard(set.id, this.editingId, {
        front_type: d.front_type,
        front_content: d.front_content.trim(),
        front_instruction: d.front_instruction.trim(),
        back_type: d.back_type,
        back_content: d.back_content.trim(),
        back_explanation: d.back_explanation.trim(),
      });
      if (revision !== this.sessionRevision) return;
      this.editingId = saved.id;
      await this.refresh(set.id);
      this.editor.set(null);
      this.toast.success(this.t('changesSaved'), this.t('cardSaved'));
    });
  }
  async upload(event: Event, face: 'front' | 'back') {
    if (!this.canEdit()) return;
    const revision = this.sessionRevision;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.toast.error(this.t('smallerPicture'));
      input.value = '';
      return;
    }
    this.uploading.set(true);
    try {
      const result = await this.api.upload(file);
      if (revision !== this.sessionRevision) return;
      this.cardDraft[`${face}_content`] = result.url;
      this.toast.success(this.t('pictureUploaded'));
    } catch (e) {
      await this.error(e);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
  changeFace(face: 'front' | 'back') {
    this.cardDraft[`${face}_content`] = '';
  }
  async reorder(card: Flashcard, direction: number) {
    const set = this.selected();
    if (!set || !this.canEdit(set) || this.busy()) return;
    const revision = this.sessionRevision;
    const cards = [...set.cards];
    const i = cards.findIndex((c) => c.id === card.id);
    const j = i + direction;
    if (j < 0 || j >= cards.length) return;
    [cards[i], cards[j]] = [cards[j], cards[i]];
    await this.mutate(async () => {
      await this.api.reorder(
        set.id,
        cards.map((c) => c.id),
      );
      if (revision !== this.sessionRevision) return;
      await this.refresh(set.id);
      this.toast.success(this.t('orderUpdated'));
    });
  }
  async confirmDelete() {
    const target = this.deleteTarget();
    const set = this.selected();
    if (!target || !this.canEdit(set) || this.busy()) return;
    const revision = this.sessionRevision;
    await this.mutate(async () => {
      if (target.kind === 'set') {
        await this.api.deleteSet(target.id);
        if (revision !== this.sessionRevision) return;
        const sets = await this.api.sets();
        if (revision !== this.sessionRevision) return;
        this.sets.set(sets);
        this.library();
      } else if (set) {
        await this.api.deleteCard(set.id, target.id);
        if (revision !== this.sessionRevision) return;
        await this.refresh(set.id);
      }
      this.deleteTarget.set(null);
      this.toast.success(target.kind === 'set' ? this.t('setDeleted') : this.t('cardDeleted'));
    });
  }
  private async refresh(id: string) {
    const revision = this.sessionRevision;
    const detail = await this.api.detail(id);
    if (revision !== this.sessionRevision) return;
    this.selected.set(detail);
    const sets = await this.api.sets();
    if (revision !== this.sessionRevision) return;
    this.sets.set(sets);
    this.newRound();
  }
  private async mutate(action: () => Promise<void>) {
    this.busy.set(true);
    try {
      await action();
    } catch (e) {
      await this.error(e);
    } finally {
      this.busy.set(false);
    }
  }
  private async error(error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.clearSession();
      this.toast.error(this.t('signInAgain'), this.t('errorTitle'));
      try {
        this.sets.set(await this.api.sets());
      } catch {
        this.failure.set(true);
      }
      return;
    }
    const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
    const message =
      typeof detail === 'string'
        ? this.i18n.error(detail)
        : Array.isArray(detail)
          ? this.i18n.language() === 'en'
            ? detail.map((d: { msg: string }) => d.msg).join('. ')
            : this.t('invalidInput')
          : this.t('serverUnreachable');
    this.toast.error(message, this.t('errorTitle'), { timeOut: 7000 });
  }
}
