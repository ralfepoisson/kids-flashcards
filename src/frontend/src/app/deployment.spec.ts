import { TestBed } from '@angular/core/testing';
import {
  APP_BASE_HREF,
  Location,
  LocationStrategy,
  PathLocationStrategy,
  PlatformLocation,
} from '@angular/common';
import { MockPlatformLocation, MOCK_PLATFORM_LOCATION_CONFIG } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideToastr, ToastrService } from 'ngx-toastr';
import { Api } from './api';
import { App } from './app';

const owner = {
  subject: 'parent',
  accountId: 'family',
  displayName: 'Parent',
  email: 'parent@example.test',
};
const lesson = {
  id: 'lesson',
  name: 'Pictures',
  description: '',
  card_count: 1,
  created_at: '',
  is_public: true,
  can_edit: true,
};
const picture = {
  id: 'picture',
  set_id: 'lesson',
  position: 0,
  front_type: 'image' as const,
  front_content: '/uploads/front.png',
  front_instruction: '',
  back_type: 'image' as const,
  back_content: '/uploads/back.png',
  back_explanation: '',
};

describe('Deployment under /flashcards', () => {
  let base: HTMLBaseElement;
  beforeEach(async () => {
    base = document.createElement('base');
    base.href = '/flashcards/';
    document.head.prepend(base);
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideToastr(),
        { provide: APP_BASE_HREF, useValue: '/flashcards/' },
        { provide: PlatformLocation, useClass: MockPlatformLocation },
        { provide: LocationStrategy, useClass: PathLocationStrategy },
        {
          provide: MOCK_PLATFORM_LOCATION_CONFIG,
          useValue: { startUrl: 'http://localhost/flashcards/set/lesson/practice' },
        },
      ],
    }).compileComponents();
  });
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } finally {
      TestBed.inject(ToastrService).clear();
      sessionStorage.clear();
      base.remove();
      TestBed.resetTestingModule();
    }
  });

  it('keeps every API request inside the app mount including the configured exchange route', async () => {
    const api = TestBed.inject(Api);
    const http = TestBed.inject(HttpTestingController);
    const calls = [
      { run: () => api.me(), path: '/auth/me', method: 'GET' },
      { run: () => api.authConfig(), path: '/auth/config', method: 'GET' },
      {
        run: () => api.exchangeCode('/api/auth/exchange', 'code'),
        path: '/auth/exchange',
        method: 'POST',
      },
      { run: () => api.session('token'), path: '/auth/session', method: 'POST' },
      { run: () => api.logout(), path: '/auth/session', method: 'DELETE' },
      { run: () => api.sets(), path: '/sets', method: 'GET' },
      { run: () => api.detail('lesson'), path: '/sets/lesson', method: 'GET' },
      { run: () => api.saveSet(null, lesson), path: '/sets', method: 'POST' },
      { run: () => api.saveSet('lesson', lesson), path: '/sets/lesson', method: 'PUT' },
      { run: () => api.deleteSet('lesson'), path: '/sets/lesson', method: 'DELETE' },
      {
        run: () => api.saveCard('lesson', null, picture),
        path: '/sets/lesson/cards',
        method: 'POST',
      },
      {
        run: () => api.saveCard('lesson', 'picture', picture),
        path: '/sets/lesson/cards/picture',
        method: 'PUT',
      },
      {
        run: () => api.deleteCard('lesson', 'picture'),
        path: '/sets/lesson/cards/picture',
        method: 'DELETE',
      },
      {
        run: () => api.reorder('lesson', ['picture']),
        path: '/sets/lesson/cards/reorder',
        method: 'PUT',
      },
      {
        run: () => api.upload(new File(['picture'], 'picture.png')),
        path: '/uploads',
        method: 'POST',
      },
    ];
    for (const call of calls) {
      const pending = call.run();
      const request = http.expectOne('/flashcards/api' + call.path);
      expect(request.request.method).toBe(call.method);
      if (call.path.endsWith('/cards'))
        expect(request.request.body.front_content).toBe('/uploads/front.png');
      request.flush({});
      await pending;
    }
    const pending = api.exchangeCode('https://auth.example/exchange', 'code');
    http.expectOne('https://auth.example/exchange').flush({ token: 'token' });
    await pending;
  });

  async function open() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/flashcards/api/auth/me').flush({ authenticated: true, user: owner });
    await Promise.resolve();
    http.expectOne('/flashcards/api/sets').flush([lesson]);
    await fixture.whenStable();
    http.expectOne('/flashcards/api/sets/lesson').flush({ ...lesson, cards: [picture] });
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('restores deep links and renders protected images in practice, editing and upload previews', async () => {
    const fixture = await open();
    const app = fixture.componentInstance;
    const platform = TestBed.inject(PlatformLocation);
    expect(app.mode()).toBe('practice');
    expect(
      fixture.nativeElement.querySelector('.practice-card-front img').getAttribute('src'),
    ).toBe('/flashcards/uploads/front.png');
    expect(fixture.nativeElement.querySelector('.practice-card-back img').getAttribute('src')).toBe(
      '/flashcards/uploads/back.png',
    );
    app.switchMode('edit');
    fixture.detectChanges();
    expect(platform.pathname).toBe('/flashcards/set/lesson/edit');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      '/flashcards/uploads/front.png',
    );
    app.openCard(picture);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.upload-preview').getAttribute('src')).toBe(
      '/flashcards/uploads/front.png',
    );
    expect(app.cardDraft.front_content).toBe('/uploads/front.png');
    app.closeEditor();
    app.library();
    expect(platform.pathname).toBe('/flashcards/');
  });

  it('scrubs the prefixed callback immediately and restores the in-app return path', async () => {
    const location = TestBed.inject(Location);
    const platform = TestBed.inject(PlatformLocation);
    location.replaceState('/auth/callback?handoff_code=code');
    sessionStorage.setItem('kids-flashcards-login-pending', '1');
    sessionStorage.setItem('kids-flashcards-login-return', '/set/lesson/edit');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(platform.pathname).toBe('/flashcards/');
    expect(platform.search).toBe('');
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/flashcards/api/auth/config')
      .flush({ signInUrl: 'https://auth.example/login', exchangeUrl: '/api/auth/exchange' });
    await Promise.resolve();
    http.expectOne('/flashcards/api/auth/exchange').flush({ token: 'token' });
    await Promise.resolve();
    http.expectOne('/flashcards/api/auth/session').flush({});
    await Promise.resolve();
    http.expectOne('/flashcards/api/auth/me').flush({ authenticated: true, user: owner });
    await Promise.resolve();
    http.expectOne('/flashcards/api/sets').flush([lesson]);
    await fixture.whenStable();
    http.expectOne('/flashcards/api/sets/lesson').flush({ ...lesson, cards: [picture] });
    await fixture.whenStable();
    expect(platform.pathname).toBe('/flashcards/set/lesson/edit');
    expect(sessionStorage.length).toBe(0);
  });
});
