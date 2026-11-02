import { chromium } from '/workspace/reta-android/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root='/workspace/reta-android/dist-cap/client';
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(root,p);
 if(q.method!=='GET'){r.writeHead(404);return r.end('no server in APK');}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()) f=path.join(root,'index.html');
 r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(8099);
const out='/workspace/reta-android/consultor/shots/p5'; fs.mkdirSync(out,{recursive:true}); const log=[];
const U='http://127.0.0.1:8099';
const b=await chromium.launch();
const sizes=[['360',{width:360,height:780}],['320',{width:320,height:568}],['paisagem',{width:780,height:360}]];
for (const scheme of ['light','dark']) for (const [sn,vp] of sizes) {
 if(sn!=='360' && scheme==='dark') continue;
 const ctx=await b.newContext({viewport:vp,deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:scheme});
 const pg=await ctx.newPage(); pg.on('pageerror',e=>log.push(`${scheme}/${sn} pageerror ${e.message}`)); pg.on('console',m=>m.type()==='error'&&log.push(`${scheme}/${sn} console ${m.text().slice(0,160)}`));
 await pg.goto(U+'/boas-vindas'); await pg.waitForTimeout(1500);
 const shot=async n=>pg.screenshot({path:`${out}/${n}-${scheme}-${sn}.png`,fullPage:true});
  await pg.getByRole('button',{name:/Começar/}).click(); await pg.waitForTimeout(700);
  await pg.setInputFiles('input[type=file]','/workspace/fase2/plano-teste.xlsx'); await pg.waitForTimeout(2500);
 
 const ex=pg.getByText('Como conseguir a chave'); if(await ex.count()){await ex.first().click(); await pg.waitForTimeout(300); }
 await pg.getByRole('button',{name:'Agora não'}).first().click(); await pg.waitForTimeout(700);
  await pg.getByRole('button',{name:/Agora não|Continuar/}).first().click().catch(e=>log.push('fim '+e.message)); await pg.waitForTimeout(1200);
 log.push(`${scheme}/${sn} após onboarding url=${pg.url()}`);

 await pg.evaluate(async()=>{const db=await new Promise((ok,ko)=>{const r=indexedDB.open('reta');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);});
  const put=(st,v)=>new Promise((ok,ko)=>{const t=db.transaction(st,'readwrite');t.objectStore(st).put(v);t.oncomplete=ok;t.onerror=()=>ko(t.error);});
  const now=Date.now(); const D=n=>{const d=new Date(now-n*864e5);return d.toISOString().slice(0,10)};
  let i=0; for(const [n,min,k] of [[6,45,'A'],[5,30,'B'],[4,60,'A'],[3,20,'R'],[2,50,'A'],[1,35,'B'],[0,25,'A']]){i++;
   await put('sessions',{id:'seed-s'+i,date:D(n),kind:k,mode:'cheio',sheetMin:60,budgetMin:60,bonusMin:0,elapsedSec:min*60,running:false,runStartedAt:null,status:'done',step:'dominio',diagCorrect:true,asked:[],correct:3,wrong:1,difficulty:'medio',missed:[],startedAt:now-n*864e5-min*6e4,endedAt:now-n*864e5,endsAt:null});}
  const M=[['Matemática','Funções do 1º grau','lacuna_teorica',0],['Física','Leis de Ohm','atencao',0],['Química','Estequiometria','interpretacao',2],['Matemática','Porcentagem','tempo',-1]];
  let j=0; for(const [sub,top,why,due] of M){j++;
   await put('mistakes',{id:'seed-m'+j,sessionId:'seed-s'+j,date:D(3),kind:'A',topic:top,subject:sub,prompt:'Questão de exemplo sobre '+top+': qual alternativa está correta?',choices:['A','B','C','D'],correctIndex:1,userIndex:2,explanation:'Explicação de exemplo.',createdAt:now-3*864e5,reviewed:false,errorReason:why,srsStage:1,nextReviewAt:D(-due),source:'sessao'});}
  db.close();});
 await pg.reload(); await pg.waitForTimeout(1500);
 await pg.goto(U+'/sessao?dia=2026-11-01&bloco=A&modo=cheio&auto=0'); await pg.waitForTimeout(1800); await shot('sessao');
 const prof=pg.getByRole('button',{name:/Professor|professor/}); if(await prof.count()){await prof.first().click(); await pg.waitForTimeout(900); await pg.screenshot({path:`${out}/sessao-chat-${scheme}-${sn}.png`}); await pg.keyboard.press('Escape');}
 for (const [n,u] of [['hoje','/'],['ajustes','/ajustes'],['importar','/importar'],['erros','/erros'],['plano','/plano'],['progresso','/progresso']]) { await pg.goto(U+u); await pg.waitForTimeout(1800); await shot(n);
  if(n==='hoje'){const m=pg.getByRole('button',{name:'Mais opções'}); if(await m.count()){await m.first().click(); await pg.waitForTimeout(400); await shot('hoje-menu'); await pg.keyboard.press('Escape');}}
  if(n==='importar'){await pg.setInputFiles('input[type=file]','/workspace/fase2/plano-teste.xlsx').catch(e=>log.push('imp '+e.message)); await pg.waitForTimeout(2500); await shot('importar-previa');}
  if(n==='erros'){const r=pg.getByRole('button',{name:/Começar revisão/}); if(await r.count()){await r.first().click(); await pg.waitForTimeout(900); await pg.screenshot({path:`${out}/erros-revisao-${scheme}-${sn}.png`}); await pg.goBack(); await pg.waitForTimeout(800);}}
  if(n==='plano'){const r=pg.locator('main button, main [role=button]').filter({hasText:/\d\d\/\d\d|Matem/}); if(await r.count()){await r.first().click(); await pg.waitForTimeout(800); await pg.screenshot({path:`${out}/plano-detalhe-${scheme}-${sn}.png`}); await pg.keyboard.press('Escape');}}
  if(sn==='360'){const small=await pg.$$eval('button,a,[role=button],[role=switch],input,select',els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<48||r.width<48)}).map(e=>`${(e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,30)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)); log.push(`${scheme} alvos<48px ${u}: ${small.length} ${small.slice(0,6).join(' | ')}`);} }
 await ctx.close();
}
await b.close(); srv.close(); fs.writeFileSync(out+'/log.txt',log.join('\n')); console.log(log.join('\n'));
