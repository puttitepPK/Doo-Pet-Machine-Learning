// Read-only SSR smoke check. No account, storage or database requests are made.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

process.env.VITE_SUPABASE_URL = '';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = '';
const root = fileURLToPath(new URL('..', import.meta.url));
// useAuth is a client-only external store (no getServerSnapshot). Replace it
// only in this test server; production auth behavior remains unchanged.
globalThis.__DOO_PET_SMOKE_AUTH__ = { user: null, loading: false, recovery: false };
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', plugins: [{
  name: 'smoke-auth-fixture', enforce: 'pre',
  transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/features/auth/hooks/useAuth.js')) {
      return 'export function useAuth() { return globalThis.__DOO_PET_SMOKE_AUTH__; }';
    }
  },
}] });
try {
  const { default: Routes } = await server.ssrLoadModule('/src/app/routes.jsx');
  for (const [route, marker] of [
    ['/check', 'check-page'], ['/history', 'history-login-prompt'], ['/clinics', 'clinics-page'],
    ['/about', 'da-'], ['/login', 'auth-'], ['/signup', 'auth-'],
  ]) {
    const html = renderToString(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(Routes, { user: null })));
    assert.ok(html.includes(marker), `${route}: missing page marker ${marker}`);
    console.log(`SSR render OK: ${route}`);
  }
  const { default: Home } = await server.ssrLoadModule('/src/features/home/pages/HomePage.jsx');
  assert.ok(renderToString(React.createElement(MemoryRouter, null, React.createElement(Home))).includes('hero'));
  console.log('SSR render OK: Home (preserved component, no active route)');
  const { default: Settings } = await server.ssrLoadModule('/src/features/settings/pages/SettingsPage.jsx');
  assert.equal(renderToString(React.createElement(MemoryRouter, null, React.createElement(Settings))), '');
  console.log('SSR render OK: Settings unauthenticated Navigate (client redirect still requires browser)');
  globalThis.__DOO_PET_SMOKE_AUTH__ = { user: { id: 'local-fixture', name: 'Test', email: 'test@example.invalid', avatar: '/images/avatars/profile-1.png' }, loading: false, recovery: false };
  for (const [route, marker] of [['/settings', 'settings-page'], ['/history', 'history-page'], ['/check', 'check-page']]) {
    const html = renderToString(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(Routes, { user: globalThis.__DOO_PET_SMOKE_AUTH__.user })));
    assert.ok(html.includes(marker), `${route}: signed-in fixture missing ${marker}`);
    console.log(`SSR render OK: ${route} (signed-in local fixture, no real data)`);
  }
  globalThis.__DOO_PET_SMOKE_AUTH__.user.avatar = '/avatars/profile-1.png';
  const legacyAccount = renderToString(React.createElement(MemoryRouter, null, React.createElement(Settings)));
  assert.ok(legacyAccount.includes('aria-pressed="true" class="selected"'), 'Legacy account avatar must remain selected');
  const { default: PetEditor } = await server.ssrLoadModule('/src/features/pets/components/PetEditor.jsx');
  const legacyPet = renderToString(React.createElement(PetEditor, { animal: { name: 'Fixture', img: '/dogs/Buddy.png' } }));
  assert.ok(legacyPet.includes('aria-label="เลือกรูป Buddy" aria-pressed="true" class="selected"'), 'Legacy pet avatar must remain selected');
  console.log('Legacy account/pet avatar selections OK (no data migration)');
} finally {
  await server.close();
  delete globalThis.__DOO_PET_SMOKE_AUTH__;
}
