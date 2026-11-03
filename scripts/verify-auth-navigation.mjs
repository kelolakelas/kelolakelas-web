import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const origin = process.env.AUTH_NAVIGATION_ORIGIN || 'http://127.0.0.1:3232';
const execute = promisify(execFile);
const browserSession = `kel232-auth-${process.pid}`;
const browser = async (...args) => (await execute('agent-browser', ['--session', browserSession, ...args], { encoding: 'utf8' })).stdout;
let socket;
try {
  await browser('open', origin);
  socket = new WebSocket((await browser('get', 'cdp-url')).trim());
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let counter = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  };
  const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++counter;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetInfos } = await command('Target.getTargets');
  const target = targetInfos.find(item => item.type === 'page' && item.url.startsWith(origin));
  assert.ok(target, 'Production page exists');
  const { sessionId } = await command('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception.description);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const key = async key => {
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: key === 'Tab' ? 9 : 13 }, sessionId);
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: key === 'Tab' ? 9 : 13 }, sessionId);
  };
  const visit = async route => {
    await command('Page.navigate', { url: origin + route }, sessionId);
    await waitFor(`location.pathname === ${JSON.stringify(route.split('?')[0])} && document.readyState === 'complete'`);
  };
  const activateLink = async (label, destination) => {
    await waitFor(`Array.from(document.querySelectorAll('a')).some(element=>element.textContent.trim()===${JSON.stringify(label)})`);
    let found = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      await key('Tab');
      if (await evaluate(`document.activeElement?.tagName==='A' && document.activeElement.textContent.trim()===${JSON.stringify(label)}`)) { found = true; break; }
    }
    assert.ok(found, `${label} reachable with Tab`);
    const details = await evaluate(`(() => {const element=document.activeElement; const box=element.getBoundingClientRect(); const style=getComputedStyle(element); return {href:element.getAttribute('href'),outline:style.outlineStyle,width:style.outlineWidth,visible:box.width>0&&box.height>0&&box.left>=0&&box.right<=innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,form:!!element.closest('form'),dialogs:document.querySelectorAll('dialog[open]').length}})()`);
    assert.equal(details.href, destination);
    assert.ok(details.visible, `${label} visible without horizontal clipping`);
    assert.equal(details.overflow, false, `${label} no horizontal overflow`);
    assert.notEqual(details.outline, 'none', `${label} visible keyboard focus`);
    assert.notEqual(details.width, '0px');
    assert.equal(details.form, false, `${label} does not submit a form`);
    assert.equal(details.dialogs, 0);
    await key('Enter');
    await waitFor(`location.pathname===${JSON.stringify(destination)} && !location.search`);
    assert.equal(await evaluate('document.querySelectorAll("dialog[open]").length'), 0);
  };
  const results = [];
  for (const [width, height] of [[1280,900],[390,844],[320,640]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await visit('/');
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('a')).find(element=>element.textContent.trim().startsWith('Daftar untuk akses awal')).getAttribute('href')`), '/register');
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('a')).find(element=>element.textContent.trim()==='Gabung pengguna awal').getAttribute('href')`), '/register');
    await activateLink('Akses awal', '/login');
    await waitFor(`document.querySelector('input[name="password"]')`);
    assert.equal(await evaluate(`document.querySelector('a[href="/forgot-password"]').textContent.trim()`), 'Lupa password?');
    assert.ok(await evaluate(`!!document.querySelector('a[href="/platform/login"]')`));
    await evaluate(`document.querySelector('input[name="password"]').value='sensitive-not-forwarded'`);
    await activateLink('Daftar', '/register');
    await waitFor(`document.querySelector('button[aria-pressed="true"]')`);
    await activateLink('Masuk', '/login');
    await visit('/register?type=tenant&from=invitation');
    await waitFor(`document.querySelector('button[aria-pressed="true"]')?.textContent.includes('Organization')`);
    await activateLink('Masuk', '/login');
    await visit('/login?redirectTo=%2Finvitations%2Faccept%3Ftoken%3Dfixture');
    await waitFor(`document.querySelector('input[name="redirectTo"]')`);
    assert.equal(await evaluate(`document.querySelector('input[name="redirectTo"]').value`), '/invitations/accept?token=fixture');
    await activateLink('Daftar', '/register');
    results.push({ viewport: [width,height], keyboard: 'Tab + Enter', focus: 'visible', overflow: false, secretForwarded: false, landing: 'login without modal', personas: 'parent + organization' });
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  socket?.close();
  await browser('close').catch(() => {});
}
