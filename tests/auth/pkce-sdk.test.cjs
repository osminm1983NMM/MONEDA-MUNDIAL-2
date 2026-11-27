'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { test } = require('node:test');
const { AuthClient } = require('@supabase/auth-js');
const { createAuthStorage } = require('../../auth-storage.js');

test('locked Supabase Auth SDK recovers on restart using the native storage adapter', async t => {
  const storageKey = 'sb-mwdtest-auth-token';
  const redirect = 'com.monedamundial.lab.samsung://auth/reset-password';
  const secureValues = new Map();
  const legacyValues = new Map([[storageKey, 'old-plaintext-session'], ['demo-operation', 'retain']]);
  const secure = {
    async getItemAsync(key) { return secureValues.get(key) ?? null; },
    async setItemAsync(key, value) { secureValues.set(key, value); },
    async deleteItemAsync(key) { secureValues.delete(key); },
  };
  const legacy = {
    async getAllKeys() { return [...legacyValues.keys()]; },
    async removeItem(key) { legacyValues.delete(key); },
  };
  const user = { id: 'synthetic-recovery-user', aud: 'authenticated', email: 'test@example.invalid' };
  let challenge, tokenRequests = 0, passwordChanges = 0;
  function json(body) {
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  }
  const fetch = async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://auth.example.invalid');
    const body = init.body ? JSON.parse(init.body) : null;
    if (init.method === 'POST' && url.pathname === '/recover') {
      assert.equal(url.searchParams.get('redirect_to'), redirect);
      assert.equal(body.code_challenge_method, 's256');
      challenge = body.code_challenge;
      return json({});
    }
    if (init.method === 'POST' && url.pathname === '/token') {
      tokenRequests++;
      assert.equal(url.searchParams.get('grant_type'), 'pkce');
      assert.equal(body.auth_code, 'synthetic-code');
      assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge);
      return json({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
        expires_in: 3600, token_type: 'bearer', user });
    }
    if (init.method === 'PUT' && url.pathname === '/user') {
      assert.equal(init.headers.Authorization, 'Bearer synthetic-access');
      assert.equal(body.password, 'synthetic-replacement');
      passwordChanges++;
      return json(user);
    }
    assert.fail('Unexpected Auth request: ' + init.method + ' ' + url.pathname);
  };
  const client = store => new AuthClient({
    url: 'https://auth.example.invalid',
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: true,
    flowType: 'pkce',
    storageKey,
    storage: createAuthStorage(store, legacy, storageKey),
    fetch,
  });

  const beforeRestart = client(secure);
  await beforeRestart.initialize();
  assert.equal((await beforeRestart.resetPasswordForEmail(user.email, { redirectTo: redirect })).error, null);
  assert.ok(challenge);
  assert.deepEqual([...legacyValues], [['demo-operation', 'retain']]);

  const emptySecure = { ...secure, async getItemAsync() { return null; }, async deleteItemAsync() {} };
  const otherDevice = client(emptySecure);
  const missing = await otherDevice.exchangeCodeForSession('synthetic-code');
  assert.ok(missing.error);
  assert.equal(tokenRequests, 0);

  const afterRestart = client(secure);
  const events = [];
  const { data: { subscription } } = afterRestart.onAuthStateChange((event, session) => {
    events.push([event, session?.user?.id]);
  });
  t.after(() => subscription.unsubscribe());
  const { data, error } = await afterRestart.exchangeCodeForSession('synthetic-code');
  assert.equal(error, null);
  assert.equal(data.redirectType, 'recovery');
  assert.equal(data.session.user.id, user.id);
  // The app checks the user recorded by the callback immediately after awaiting exchange.
  assert.deepEqual(events.filter(([name]) => name === 'PASSWORD_RECOVERY'), [['PASSWORD_RECOVERY', user.id]]);
  assert.equal((await afterRestart.updateUser({ password: 'synthetic-replacement' })).error, null);
  assert.equal(passwordChanges, 1);
  assert.equal((await client(secure).getSession()).data.session.user.id, user.id);
  const replay = await afterRestart.exchangeCodeForSession('synthetic-code');
  assert.ok(replay.error);
  assert.equal(tokenRequests, 1);
  assert.equal(events.filter(([event]) => event === 'PASSWORD_RECOVERY').length, 1);
});
