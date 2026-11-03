import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScheduleRequestForm } from './app/(public)/kelas/[id]/_components/ScheduleRequestForm';
import { RescheduleDialog } from './app/(dashboard)/dashboard/tenant/sessions/_components/RescheduleDialog';
window.calls=[];
window.action=async(name,args)=>{window.calls.push({name,data:Object.fromEntries(args.find(value=>value instanceof FormData))});return {success:false,message:'Fixture server rejected request'};};
createRoot(document.getElementById('root')).render(<main><ScheduleRequestForm classId="class" initialStudentId="student" students={[{id:'student',first_name:'Fixture',last_name:'Student'}]} /><RescheduleDialog sessionId="session" sessionLabel="Fixture" idPrefix="fixture" /><button id="outside">Outside</button></main>);
`;
const bundled = await build({
  stdin: { contents: fixture, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  tsconfig: path.join(root, 'tsconfig.json'),
  plugins: [{ name: 'fixture-boundaries', setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default function Link(){return null}' }));
    builder.onLoad({ filter: /\.[tj]sx?$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      if (!/^['"]use server['"];/.test(source.trimStart())) return;
      const names = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(match => match[1]);
      return { contents: names.map(name => `export const ${name}=async(...args)=>window.action('${name}',args);`).join('\n'), loader: 'js' };
    });
  } }],
});
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/bundle.js' ? 'text/javascript' : 'text/html');
  response.end(request.url === '/bundle.js' ? bundled.outputFiles[0].text : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const execute = promisify(execFile);
const browserSession = `kel233-time-${process.pid}`;
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
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  };
  const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++counter;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetInfos } = await command('Target.getTargets');
  const target = targetInfos.find(item => item.type === 'page' && item.url.startsWith(origin));
  const { sessionId } = await command('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception.description);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const key = async (key, modifiers = 0) => {
    const windowsVirtualKeyCode = { Tab: 9, Backspace: 8, Delete: 46 }[key];
    for (const type of ['keyDown', 'keyUp']) await command('Input.dispatchKeyEvent', { type, key, code: key, modifiers, windowsVirtualKeyCode }, sessionId);
  };
  const type = async text => {
    for (const digit of text) await command('Input.insertText', { text: digit }, sessionId);
  };
  const inspect = selector => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});return {value:input.value,start:input.selectionStart,end:input.selectionEnd,valid:input.checkValidity(),active:document.activeElement===input}})()`);
  const focus = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  const results = [];
  for (const [width, height, mobile] of [[1280,900,false],[390,844,true]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 }, sessionId);
    await command('Page.navigate', { url: origin }, sessionId);
    await waitFor('document.querySelector("#schedule-request-start-0")');
    for (const [selector, hour] of [['#schedule-request-start-0','09'],['#schedule-request-end-0','10']]) {
      await focus(selector);
      await type(hour[0]);
      assert.equal((await inspect(selector)).start, 1);
      await type(hour[1]);
      const advanced = await inspect(selector);
      assert.equal(advanced.start, 3);
      assert.equal(advanced.active, true);
      await type('30');
      assert.equal((await inspect(selector)).value, `${hour}:30`);
    }
    await focus('#schedule-request-start-0');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.id'), 'schedule-request-end-0');
    await key('Tab', 8);
    assert.equal(await evaluate('document.activeElement.id'), 'schedule-request-start-0');
    await evaluate('document.activeElement.setSelectionRange(0,2)');
    await type('24');
    assert.equal((await inspect('#schedule-request-start-0')).valid, false);
    assert.equal((await inspect('#schedule-request-start-0')).start, 2);
    await key('Backspace');
    assert.equal((await inspect('#schedule-request-start-0')).value, '2:30');
    await evaluate('document.activeElement.select()');
    await command('Input.insertText', { text: '08:59' }, sessionId);
    assert.equal((await inspect('#schedule-request-start-0')).value, '08:59');
    await evaluate('document.activeElement.setSelectionRange(0,2)');
    await key('Delete');
    assert.equal((await inspect('#schedule-request-start-0')).value, ':59');
    await type('09');
    await type('00');
    await evaluate('document.querySelector("#schedule-request-start-0").form.requestSubmit()');
    await waitFor('window.calls.length===1');
    const submitted = await evaluate('window.calls[0]');
    assert.deepEqual(JSON.parse(submitted.data.slots), [{day_of_week:1,start_time:'09:00',end_time:'10:30'}]);
    await waitFor('document.querySelector("[role=alert]")?.textContent.includes("Fixture server rejected")');
    assert.equal((await inspect('#schedule-request-start-0')).value, '09:00');
    await focus('#schedule-request-end-0');
    await evaluate('document.activeElement.select()');
    await command('Input.insertText', { text: '08:00' }, sessionId);
    await evaluate('document.activeElement.form.requestSubmit()');
    assert.equal(await evaluate('window.calls.length'), 1);
    assert.ok(await evaluate('document.querySelector("#schedule-request-slot-error")?.textContent.length>0'));
    await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.textContent.trim()==="Reschedule").click()');
    for (const [selector, hour] of [['#fixture-reschedule-dialog-start','12'],['#fixture-reschedule-dialog-end','13']]) {
      await focus(selector);
      await type(hour);
      assert.equal((await inspect(selector)).start, 3);
      await type('45');
      assert.equal((await inspect(selector)).value, `${hour}:45`);
    }
    await evaluate('document.querySelector("dialog").close();HTMLInputElement.prototype.setSelectionRange=()=>{throw new DOMException("Unsupported","InvalidStateError")};document.querySelector("#schedule-request-start-0").blur()');
    await evaluate('new Promise(resolve=>setTimeout(resolve,50))');
    await focus('#schedule-request-start-0');
    await evaluate('document.activeElement.select()');
    await type('1130');
    assert.equal((await inspect('#schedule-request-start-0')).value, '11:30');
    results.push({viewport:[width,height],mobile, parent:'hour advancement, invalid/incomplete, correction, deletion, bulk insertion, Tab/Shift+Tab, payload, server error retention, end-before-start',reschedule:'both fields advance',unsupportedSelection:'manual entry survives'});
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  socket?.close();
  await browser('close').catch(() => {});
  await new Promise(resolve => server.close(resolve));
}
