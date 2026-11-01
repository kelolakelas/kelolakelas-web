import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const inventory = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(filename);
    else if (filename.endsWith('.tsx') && !filename.endsWith('.test.tsx')) {
      const source = ts.createSourceFile(filename, await readFile(filename, 'utf8'), 99, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === 'dialog') {
          const attribute = node.attributes.properties.find(item => item.name?.getText(source) === 'className');
          if (attribute && ts.isStringLiteral(attribute.initializer)) {
            inventory.push({ file: path.relative(root, filename), className: attribute.initializer.text });
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}
await scan(path.join(root, 'app'));
assert.equal(inventory.length, 20, 'Review inventory when adding/removing an independent native dialog');

const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ModalDialog } from './components/ModalDialog';
import { EnrollmentPanel } from './app/(public)/kelas/[id]/_components/EnrollmentPanel';
import { ClassEditModal } from './app/(dashboard)/dashboard/tenant/classes/_components/ClassEditModal';
import { ClassCreationWizard } from './app/(dashboard)/dashboard/tenant/classes/_components/ClassCreationWizard';
import { RoleEditModal } from './app/(dashboard)/dashboard/tenant/roles/_components/RoleEditModal';
import { EarlyAccessModal } from './app/(public)/_components/EarlyAccessModal';
import { ApproveScheduleRequestDialog } from './app/(dashboard)/dashboard/tenant/schedule-requests/_components/ApproveScheduleRequestDialog';
import { RescheduleDialog } from './app/(dashboard)/dashboard/tenant/sessions/_components/RescheduleDialog';
const record = { id:'class', category_id:'category', tenant_id:'tenant', name:'Browser class', type:'private', price:100000, private_slot_limit:1, status:'active', created_at:'' };
window.record = record;
window.actionMode = 'error';
window.actionCalls = [];
window.action = async (name, args) => {
  window.actionCalls.push(name);
  if (name === 'getScheduleTeachers') return {state:'ok', teachers:[]};
  if (name === 'readClassConfiguration') return {success:true,data:{class:record,categories:[{id:'category',name:'Math'}],schedules:[]}};
  if (name === 'createStudent' && window.actionMode === 'success') {
    const data = args.find(value => value instanceof FormData);
    return {success:true,message:'Saved',data:{id:'student-created',parent_id:'parent',first_name:data.get('first_name'),last_name:data.get('last_name'),date_of_birth:data.get('date_of_birth')}};
  }
  await new Promise(resolve => setTimeout(resolve, 80));
  return {success:false,message:'Validation error: ' + 'Please check the supplied details. '.repeat(15)};
};
function Shared() {
  const [open,setOpen] = useState(false);
  const [long,setLong] = useState(false);
  return <><button id="shared-trigger" onClick={()=>setOpen(true)}>Shared</button>{open && <ModalDialog label="Shared fixture" onClose={()=>setOpen(false)} dismissOnBackdrop><section className="w-full max-w-md rounded bg-white p-6"><h2>Shared title</h2><button onClick={()=>setLong(!long)}>Expand error</button>{long && <div style={{height:1600}}>Expanded validation</div>}<button id="shared-close" onClick={()=>setOpen(false)}>Close</button></section></ModalDialog>}</>;
}
function Drawer() {
  const [open,setOpen] = useState(false);
  return <><button onClick={()=>setOpen(true)}>Drawer</button>{open && <ModalDialog label="Drawer fixture" layout="drawer" onClose={()=>setOpen(false)} dismissOnBackdrop><nav className="w-4/5 max-w-xs bg-white"><button onClick={()=>setOpen(false)}>Close drawer</button></nav></ModalDialog>}</>;
}
const views = {
  student:<EnrollmentPanel classId="class" classType="private" isParent students={[]} schedules={[]} idempotencyKey="browser" parentId="parent" />,
  edit:<ClassEditModal classRecord={record} categories={[]} />,
  wizard:<ClassCreationWizard existingCategories={[]} />,
  role:<RoleEditModal role={{id:'role',name:'Custom',permissions:[]}} availablePermissions={[]} />,
  early:<EarlyAccessModal />,
  approve:<ApproveScheduleRequestDialog requestId="request" studentName="Browser student" idPrefix="browser" />,
  reschedule:<RescheduleDialog sessionId="session" sessionLabel="Browser session" idPrefix="browser" />,
  shared:<Shared />,
  drawer:<Drawer />,
};
const view = new URLSearchParams(location.search).get('view') || 'shared';
createRoot(document.getElementById('root')).render(<><div style={{height:900}}>Scroll fixture</div><div id="ancestor" style={{transform:'translateX(23px)',position:'relative',overflow:'hidden',width:260,height:160}}>{views[view]}</div><button id="outside">Outside</button><div style={{height:900}} /></>);
`;

const bundled = await build({
  stdin: { contents: fixture, loader: 'tsx', resolveDir: root },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  tsconfig: path.join(root, 'tsconfig.json'),
  plugins: [{ name: 'isolated-server-actions', setup(builder) {
    builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'next-fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'next-fixture' }, args => ({ contents: args.path.endsWith('link')
      ? 'export default function Link(){return null}'
      : 'export const useRouter=()=>({refresh(){},push(){}}); export const usePathname=()=>"/"; export const redirect=()=>{};' }));
    builder.onLoad({ filter: /\.[tj]sx?$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      if (!/^['"]use server['"];/.test(source.trimStart())) return;
      const names = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(match => match[1]);
      return { contents: names.map(name => `export const ${name} = async (...args) => window.action('${name}',args);`).join('\n'), loader: 'js' };
    });
  } }],
});
const stylesheet = await postcss([tailwind()]).process(await readFile(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/bundle.js' ? 'text/javascript' : request.url === '/style.css' ? 'text/css' : 'text/html');
  response.end(request.url === '/bundle.js' ? bundled.outputFiles[0].text : request.url === '/style.css' ? stylesheet.css : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const session = `kel231-layout-${process.pid}`;
const execute = promisify(execFile);
const browser = async (...args) => (await execute('agent-browser', ['--session', session, ...args], { encoding: 'utf8' })).stdout;
let socket;
try {
  await browser('open', origin);
  const endpoint = (await browser('get', 'cdp-url')).trim();
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let counter = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  };
  function command(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++counter;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetInfos } = await command('Target.getTargets');
  const target = targetInfos.find(item => item.type === 'page' && item.url.startsWith(origin));
  const { sessionId } = await command('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception.description);
    return result.result.value;
  };
  const wait = () => new Promise(resolve => setTimeout(resolve, 250));
  const check = async (expression, label) => assert.equal(await evaluate(expression), true, label);
  const geometry = async selector => evaluate(`(() => {
    const element=document.querySelector(${JSON.stringify(selector)}); if(!element)return {missing:true};
    const box=element.getBoundingClientRect();
    return {x:box.x,y:box.y,width:box.width,height:box.height,viewport:[innerWidth,innerHeight],scroll:element.scrollHeight,client:element.clientHeight};
  })()`);
  function centered(box, label, margin = 15) {
    assert.ok(!box.missing, `${label}: missing`);
    assert.ok(Math.abs(box.x + box.width / 2 - box.viewport[0] / 2) <= 2, `${label}: horizontal ${JSON.stringify(box)}`);
    assert.ok(Math.abs(box.y + box.height / 2 - box.viewport[1] / 2) <= 2, `${label}: vertical ${JSON.stringify(box)}`);
    assert.ok(box.x >= margin && box.y >= margin, `${label}: safe margins ${JSON.stringify(box)}`);
  }
  const results = [];
  for (const [name, width, height, scale] of [['desktop',1280,900,1], ['mobile',390,844,1], ['short-keyboard-equivalent',390,320,1], ['zoom-200-equivalent',640,450,2]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false }, sessionId);
    await evaluate(`document.querySelectorAll('dialog[open]').forEach(element=>element.close());window.scrollTo(0,650)`);
    for (const item of inventory) {
      for (const long of [false, true]) {
        await evaluate(`(() => {
          const dialog=document.createElement('dialog');dialog.id='inventory';dialog.className=${JSON.stringify(item.className)};
          dialog.innerHTML='<h2>Inventory title</h2><button>Close</button><div style="height:${long ? 1600 : 40}px">Content</div><button id="last">Submit</button>';
          document.querySelector('#ancestor').append(dialog);dialog.showModal();
        })()`);
        centered(await geometry('#inventory'), `${name}:${item.file}:${long}`);
        await check(`(() => {const dialog=document.querySelector('#inventory');dialog.querySelector('#last').scrollIntoView();const box=dialog.querySelector('#last').getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight})()`, `${name}: submit reachable`);
        await evaluate(`document.querySelector('#inventory').remove()`);
      }
    }
    results.push({ viewport: name, size: [width,height], nativeTemplates: inventory.length, shortAndLong: true, tolerancePx: 2 });
  }
  for (const [view, trigger] of Object.entries({ student:'Tambah student', edit:'Edit', wizard:'Create New Class', role:'Edit', early:'Akses awal', approve:'Setujui', reschedule:'Reschedule', shared:'Shared', drawer:'Drawer' })) {
    for (const [width,height] of [[1280,900],[390,844]]) {
      await command('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false}, sessionId);
      await command('Page.navigate', {url:origin+'/?view='+view}, sessionId);
      await wait();
      await evaluate(`window.scrollTo(0,650);{const trigger=[...document.querySelectorAll('button')].find(element=>element.textContent.trim().startsWith(${JSON.stringify(trigger)}));trigger?.focus();trigger?.click()}`);
      await wait();
      await check(`!!document.querySelector('dialog:modal')`, `${view}: native top layer`);
      let measured;
      if(view==='drawer') {
        const box = await geometry('dialog:modal > nav');
        measured = box;
        assert.equal(box.x,0,'drawer remains left aligned');
      } else {
        const selector = ['edit','wizard','role','early','shared'].includes(view) ? 'dialog:modal > :first-child' : 'dialog:modal';
        const box = await geometry(selector);
        measured = box;
        if(box.height <= height-24) centered(box, `${view}:${width}`, 11);
        else assert.ok(box.y>=11, `${view}: long content starts safely`);
      }
      await evaluate(`{const controls=[...document.querySelector('dialog:modal').querySelectorAll('button,input:not([type="hidden"]),select,textarea')].filter(element=>element.getClientRects().length&&!element.disabled);controls.at(-1)?.scrollIntoView({block:'nearest'})}`);
      await check(`(() => {const controls=[...document.querySelector('dialog:modal').querySelectorAll('button,input:not([type="hidden"]),select,textarea')].filter(element=>element.getClientRects().length&&!element.disabled);const box=controls.at(-1).getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight})()`,`${view}: final control reachable`);
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},sessionId);
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},sessionId);
      if (await evaluate(`document.activeElement===document.body`)) {
        await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},sessionId);
        await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},sessionId);
      }
      await check(`document.querySelector('dialog:modal').contains(document.activeElement)`,`${view}: focus stays inside`);
      await check(`(() => {document.querySelector('#outside').focus();return document.activeElement!==document.querySelector('#outside')})()`,`${view}: background inert`);
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
      await wait();
      await check(`!document.querySelector('dialog:modal')`,`${view}: Escape closes`);
      await check(`document.activeElement.tagName==='BUTTON'`,`${view}: focus returns to trigger`);
      results.push({component:view,viewport:[width,height],box:measured,topLayer:true,focus:true,escape:true});
    }
  }
  await command('Page.navigate',{url:origin+'/?view=student'},sessionId);
  await wait();
  await evaluate(`document.querySelector('button').click()`);
  await wait();
  const fillStudent = `document.querySelector('#first_name').value='Browser child';{const clipboard=new DataTransfer();clipboard.setData('text','2015-01-01');document.querySelector('#date_of_birth').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:clipboard}))}`;
  await evaluate(fillStudent);
  await wait();
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await wait();
  await check(`!!document.querySelector('dialog:modal [role="alert"]')`, 'student validation error remains inside modal');
  centered(await geometry('dialog:modal'),'student expanded validation');
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:320,deviceScaleFactor:1,mobile:false},sessionId);
  centered(await geometry('dialog:modal'),'student live keyboard-size resize');
  await evaluate(`document.querySelector('dialog button[type="submit"]').scrollIntoView()`);
  await check(`document.querySelector('dialog button[type="submit"]').getBoundingClientRect().bottom<=innerHeight`, 'student keyboard-size submit reachable');
  await evaluate(`window.actionMode='success';${fillStudent}`);
  await wait();
  await evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await wait();
  await check(`!document.querySelector('dialog:modal') && !!document.querySelector('option[value="student-created"]:checked')`, 'student success closes and selects new child without navigation');
  await command('Page.navigate',{url:origin+'/?view=shared'},sessionId);
  await wait();
  await evaluate(`document.querySelector('#shared-trigger').click()`);
  await wait();
  await evaluate(`document.querySelector('dialog section button').click()`);
  await wait();
  await check(`document.querySelector('dialog section').getBoundingClientRect().top>=15`, 'expanded shared content does not clip title');
  await evaluate(`document.querySelector('#shared-close').scrollIntoView()`);
  await check(`document.querySelector('#shared-close').getBoundingClientRect().bottom<=innerHeight`, 'expanded shared close reachable');
  await evaluate(`document.querySelector('#shared-trigger').remove();document.querySelector('#shared-close').click()`);
  await check(`!document.querySelector('dialog:modal') && document.body.style.overflow===''`, 'missing trigger safely closes and unlocks scroll');
  results.push({studentFlow:'validation failure -> retry success -> new child selected in private request form',resize:'390x844 -> 390x320 while error modal remains open',sharedExpansion:'1600px content; title and final close reachable',removedTrigger:'close and body scroll restoration pass'});
  console.log(JSON.stringify({ serverActions:'isolated deterministic stubs; no gateway/database claims', results, inventory },null,2));
} finally {
  socket?.close();
  try { await browser('close'); } finally { await new Promise(resolve => server.close(resolve)); }
}
