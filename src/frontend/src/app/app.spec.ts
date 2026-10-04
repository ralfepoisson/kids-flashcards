import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideToastr, ToastrService } from 'ngx-toastr';
import { App } from './app';
import { Flashcard } from './models';

describe('App unit checks', () => {
  beforeEach(async () => {
    window.localStorage.setItem('kids-flashcards-language', 'en');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        provideLocationMocks(),
      ],
    }).compileComponents();
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.inject(ToastrService).clear();
    window.localStorage.removeItem('kids-flashcards-language');
  });
  it('opens sets in Practice from the library and sidebar even after editing', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    const app = fixture.componentInstance;
    const set = {
      id: 'lesson',
      name: 'French',
      description: '',
      card_count: 0,
      created_at: '',
      is_public: true,
      can_edit: true,
    };
    fixture.detectChanges();
    http
      .expectOne('/api/auth/me')
      .flush({
        authenticated: true,
        user: {
          subject: 'parent',
          accountId: 'family',
          displayName: 'Parent',
          email: 'parent@example.test',
        },
      });
    await Promise.resolve();
    http.expectOne('/api/sets').flush([set]);
    await fixture.whenStable();
    fixture.detectChanges();

    async function open(selector: string) {
      const button: HTMLButtonElement = fixture.nativeElement.querySelector(selector);
      button.click();
      http.expectOne('/api/sets/lesson').flush({ ...set, cards: [] });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(app.mode()).toBe('practice');
      expect(TestBed.inject(Location).path()).toBe('/set/lesson/practice');
      expect(fixture.nativeElement.querySelector('.mode-switch .active').textContent).toContain(
        'Practice Mode',
      );
      expect(fixture.nativeElement.textContent).toContain('Ready when your cards are');
    }

    await open('.set-tile');
    app.switchMode('edit');
    expect(TestBed.inject(Location).path()).toBe('/set/lesson/edit');
    fixture.detectChanges();
    await open('.sidebar button.set-link');
    app.switchMode('edit');
    app.library();
    expect(TestBed.inject(Location).path() || '/').toBe('/');
    fixture.detectChanges();
    await open('.set-tile');
  });
  for (const mode of ['practice', 'edit'] as const) {
    it(`loads the selected set and ${mode} mode from a deep link`, async () => {
      const location = TestBed.inject(Location);
      location.replaceState('/set/lesson/' + mode);
      const fixture = TestBed.createComponent(App);
      const http = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      http
        .expectOne('/api/auth/me')
        .flush({
          authenticated: true,
          user: {
            subject: 'parent',
            accountId: 'family',
            displayName: 'Parent',
            email: 'parent@example.test',
          },
        });
      await Promise.resolve();
      http.expectOne('/api/sets').flush([]);
      await fixture.whenStable();
      http.expectOne('/api/sets/lesson').flush({
        id: 'lesson',
        name: 'French',
        description: '',
        created_at: '',
        is_public: true,
        can_edit: true,
        card_count: 0,
        cards: [],
      });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.selected()?.id).toBe('lesson');
      expect(fixture.componentInstance.mode()).toBe(mode);
      expect(location.path()).toBe('/set/lesson/' + mode);
    });
  }
  it('retries a failed deep link without losing its set or mode', async () => {
    const location = TestBed.inject(Location);
    location.replaceState('/set/lesson/edit');
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/me')
      .flush({
        authenticated: true,
        user: {
          subject: 'parent',
          accountId: 'family',
          displayName: 'Parent',
          email: 'parent@example.test',
        },
      });
    await Promise.resolve();
    http.expectOne('/api/sets').flush([]);
    await fixture.whenStable();
    http
      .expectOne('/api/sets/lesson')
      .flush({ detail: 'Temporarily unavailable' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.componentInstance.failure()).toBe(true);
    expect(location.path()).toBe('/set/lesson/edit');
    const retry = fixture.componentInstance.load();
    http.expectOne('/api/sets').flush([]);
    await fixture.whenStable();
    http.expectOne('/api/sets/lesson').flush({
      id: 'lesson',
      name: 'French',
      description: '',
      created_at: '',
      is_public: true,
      can_edit: true,
      card_count: 0,
      cards: [],
    });
    await retry;
    expect(fixture.componentInstance.failure()).toBe(false);
    expect(fixture.componentInstance.selected()?.id).toBe('lesson');
    expect(fixture.componentInstance.mode()).toBe('edit');
  });
  it('shows an honest empty state and starts a new set form', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/me')
      .flush({
        authenticated: true,
        user: {
          subject: 'parent',
          accountId: 'family',
          displayName: 'Parent',
          email: 'parent@example.test',
        },
      });
    await Promise.resolve();
    TestBed.inject(HttpTestingController).expectOne('/api/sets').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Your learning adventure starts here');
    fixture.componentInstance.openSet();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBe(true);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#set-name');
    input.value = 'Science';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });
  it('requires content on both faces before enabling save', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/me')
      .flush({
        authenticated: true,
        user: {
          subject: 'parent',
          accountId: 'family',
          displayName: 'Parent',
          email: 'parent@example.test',
        },
      });
    await Promise.resolve();
    TestBed.inject(HttpTestingController).expectOne('/api/sets').flush([]);
    await fixture.whenStable();
    fixture.componentInstance.selected.set({
      id: 'lesson',
      name: 'French',
      description: '',
      created_at: '',
      is_public: false,
      can_edit: true,
      card_count: 0,
      cards: [],
    });
    fixture.componentInstance.openCard();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    for (const [id, value] of [
      ['front-content', 'One'],
      ['back-content', 'Un'],
    ]) {
      const input: HTMLTextAreaElement = fixture.nativeElement.querySelector('#' + id);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
  });
  it('retains the saved ID when a follow-up refresh fails so retries update it', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne('/api/auth/me')
      .flush({
        authenticated: true,
        user: {
          subject: 'parent',
          accountId: 'family',
          displayName: 'Parent',
          email: 'parent@example.test',
        },
      });
    await Promise.resolve();
    http.expectOne('/api/sets').flush([]);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    app.openSet();
    app.setDraft = { name: 'A saved lesson', description: '', is_public: false };
    const pending = app.saveSet();
    const created = {
      id: '44c3f91d-eaa2-4601-8db5-e0264d1ce638',
      name: 'A saved lesson',
      description: '',
      card_count: 0,
      created_at: new Date().toISOString(),
      is_public: true,
      can_edit: true,
    };
    http
      .expectOne((request) => request.method === 'POST' && request.url === '/api/sets')
      .flush(created);
    await Promise.resolve();
    http
      .expectOne('/api/sets')
      .flush({ detail: 'Temporarily unavailable' }, { status: 503, statusText: 'Unavailable' });
    await pending;
    expect(app.editingId).toBe(created.id);
    const retry = app.saveSet();
    http
      .expectOne((request) => request.method === 'PUT' && request.url === '/api/sets/' + created.id)
      .flush(created);
    await Promise.resolve();
    http.expectOne('/api/sets').flush([created]);
    await Promise.resolve();
    http.expectOne('/api/sets/' + created.id).flush({ ...created, cards: [] });
    await retry;
    expect(app.editor()).toBeNull();
  });

  async function practiceFixture() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auth/me')
      .flush({
        authenticated: true,
        user: {
          subject: 'parent',
          accountId: 'family',
          displayName: 'Parent',
          email: 'parent@example.test',
        },
      });
    await Promise.resolve();
    TestBed.inject(HttpTestingController).expectOne('/api/sets').flush([]);
    await fixture.whenStable();
    const cards: Flashcard[] = [
      {
        id: 'one',
        set_id: 'lesson',
        position: 0,
        front_type: 'text',
        front_content: 'One',
        back_type: 'text',
        back_content: 'Un',
        front_instruction: 'Translate.',
        back_explanation: 'French for one.',
      },
      {
        id: 'two',
        set_id: 'lesson',
        position: 1,
        front_type: 'image',
        front_content: '/uploads/front.png',
        back_type: 'image',
        back_content: '/uploads/back.png',
        front_instruction: '',
        back_explanation: '',
      },
    ];
    fixture.componentInstance.round.set(cards);
    fixture.componentInstance.mode.set('practice');
    // Render practice within a selected set, without a runtime service mock.
    fixture.componentInstance.selected.set({
      id: 'lesson',
      name: 'French',
      description: '',
      created_at: '',
      is_public: true,
      can_edit: true,
      card_count: cards.length,
      cards,
    });
    fixture.detectChanges();
    return fixture;
  }

  it('switches the whole interface with a flag immediately to the left of the app badge', async () => {
    const fixture = await practiceFixture();
    const app = fixture.componentInstance;
    app.flip();
    app.search.set('French');
    app.setDraft = { name: 'Unsaved lesson', description: 'Keep this text', is_public: false };
    fixture.detectChanges();
    const selected = JSON.stringify(app.selected());
    const round = app.round();
    const flag: HTMLButtonElement = fixture.nativeElement.querySelector('.language-toggle');
    expect(flag).not.toBeNull();
    expect(flag.textContent).toContain('🇫🇷');
    expect(flag.nextElementSibling?.textContent).toBe('Kids Flashcards');
    flag.click();
    fixture.detectChanges();
    expect(flag.textContent).toContain('🇬🇧');
    expect(flag.getAttribute('aria-label')).toBe('Switch to English');
    expect(fixture.nativeElement.textContent).toContain('Mes séries de cartes');
    expect(fixture.nativeElement.textContent).toContain('Mode entraînement');
    expect(fixture.nativeElement.querySelector('.practice-card-back').textContent).toContain('Un');
    expect(fixture.nativeElement.querySelector('.practice-note').textContent).toContain(
      'French for one.',
    );
    expect(JSON.stringify(app.selected())).toBe(selected);
    expect(app.round()).toBe(round);
    expect(app.flipped()).toBe(true);
    expect(app.search()).toBe('French');
    expect(app.setDraft.name).toBe('Unsaved lesson');
    expect(document.documentElement.lang).toBe('fr');
    expect(window.localStorage.getItem('kids-flashcards-language')).toBe('fr');
    flag.click();
    fixture.detectChanges();
    expect(flag.textContent).toContain('🇫🇷');
    expect(fixture.nativeElement.textContent).toContain('Practice Mode');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores French on reload and translates editor and delete dialogs', async () => {
    window.localStorage.setItem('kids-flashcards-language', 'fr');
    const fixture = await practiceFixture();
    fixture.componentInstance.openCard(fixture.componentInstance.current());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#editor-title').textContent).toContain(
      'Modifier la carte',
    );
    expect(fixture.nativeElement.querySelector('label[for="front-content"]').textContent).toContain(
      'Texte du recto',
    );
    expect(fixture.nativeElement.querySelector('#front-content').value).toBe('One');
    expect(fixture.nativeElement.querySelector('#back-content').value).toBe('Un');
    expect(fixture.nativeElement.querySelector('#front-instruction').value).toBe('Translate.');
    fixture.componentInstance.closeEditor();
    fixture.componentInstance.deleteTarget.set({ kind: 'set', id: 'lesson', name: 'French' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#delete-title').textContent.trim()).toBe(
      'Supprimer cette série ?',
    );
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]').textContent).toContain(
      '« French »',
    );
  });

  it('keeps both faces mounted while flipping and exposes only the current face', async () => {
    const fixture = await practiceFixture();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.practice-card');
    const inner = button.querySelector('.practice-card-inner');
    expect(inner).not.toBeNull();
    const front = button.querySelector('.practice-card-front');
    const back = button.querySelector('.practice-card-back');
    expect(front?.textContent).toContain('One');
    expect(back?.textContent).toContain('Un');
    expect(front?.getAttribute('aria-hidden')).toBe('false');
    expect(back?.getAttribute('aria-hidden')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(button.querySelector('.practice-card-inner')).toBe(inner);
    expect(inner?.classList.contains('is-flipped')).toBe(true);
    expect(front?.getAttribute('aria-hidden')).toBe('true');
    expect(back?.getAttribute('aria-hidden')).toBe('false');
    expect(fixture.nativeElement.querySelector('.practice-note').textContent).toContain(
      'French for one.',
    );
    button.click();
    fixture.detectChanges();
    expect(inner?.classList.contains('is-flipped')).toBe(false);
    expect(front?.getAttribute('aria-hidden')).toBe('false');
    expect(back?.getAttribute('aria-hidden')).toBe('true');
  });

  it('starts navigation and reshuffling on a fresh front face while preserving the flip button', async () => {
    const fixture = await practiceFixture();
    const app = fixture.componentInstance;
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.practice-card');
    button.click();
    fixture.detectChanges();
    const oldInner = button.querySelector('.practice-card-inner');
    app.move(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.practice-card')).toBe(button);
    expect(button.querySelector('.practice-card-inner')).not.toBe(oldInner);
    expect(button.querySelector('.is-flipped')).toBeNull();
    expect(button.querySelector('.practice-card-front img')?.getAttribute('src')).toBe(
      '/uploads/front.png',
    );
    expect(button.querySelector('.practice-card-back img')?.getAttribute('src')).toBe(
      '/uploads/back.png',
    );
    button.click();
    fixture.detectChanges();
    const beforeShuffle = button.querySelector('.practice-card-inner');
    app.newRound();
    fixture.detectChanges();
    expect(button.querySelector('.practice-card-inner')).not.toBe(beforeShuffle);
    expect(button.querySelector('.is-flipped')).toBeNull();
    expect(app.flipped()).toBe(false);
  });
});
