import { chromium } from '/workspace/reta-android/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root='/workspace/reta-android/dist-cap/client';
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(root,p);
 if(q.method!=='GET'){r.writeHead(404);return r.end('no server in APK');}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()) f=path.join(root,'index.html');
 r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(8099);
const out='/workspace/reta-android/consultor/shots/p2'; fs.mkdirSync(out,{recursive:true}); const log=[];
const U='http://127.0.0.1:8099';
const b=await chromium.launch();
const sizes=[['360',{width:360,height:780}],['320',{width:320,height:568}],['paisagem',{width:780,height:360}]];
for (const scheme of ['light','dark']) for (const [sn,vp] of sizes) {
 if(sn!=='360' && scheme==='dark') continue;
 const ctx=await b.newContext({viewport:vp,deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:scheme});
 const pg=await ctx.newPage(); pg.on('pageerror',e=>log.push(`${scheme}/${sn} pageerror ${e.message}`)); pg.on('console',m=>m.type()==='error'&&log.push(`${scheme}/${sn} console ${m.text().slice(0,160)}`));
 await pg.goto(U+'/boas-vindas'); await pg.waitForTimeout(1500);
 const shot=async n=>pg.screenshot({path:`${out}/${n}-${scheme}-${sn}.png`,fullPage:true});
 await shot('onboarding-1'); await pg.getByRole('button',{name:/Começar/}).click(); await pg.waitForTimeout(700);
 await shot('onboarding-2'); await pg.setInputFiles('input[type=file]','/workspace/fase2/plano-teste.xlsx'); await pg.waitForTimeout(2500);
 await shot('onboarding-3');
 const ex=pg.getByText('Como conseguir a chave'); if(await ex.count()){await ex.first().click(); await pg.waitForTimeout(300); await shot('onboarding-3-chave-aberta');}
 await pg.getByRole('button',{name:'Agora não'}).first().click(); await pg.waitForTimeout(700);
 await shot('onboarding-4'); await pg.getByRole('button',{name:/Agora não|Continuar/}).first().click().catch(e=>log.push('fim '+e.message)); await pg.waitForTimeout(1200);
 log.push(`${scheme}/${sn} após onboarding url=${pg.url()}`);
 await pg.goto(U+'/sessao?dia=2026-11-01&bloco=A&modo=cheio&auto=0'); await pg.waitForTimeout(1800);
 await shot('sessao');
 const btns=await pg.$$eval('button',bs=>bs.map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean)); log.push(`${scheme}/${sn} botoes sessao: ${btns.join(' / ')}`);
 const ini=pg.getByRole('button',{name:/Iniciar|Começar|Retomar/}); if(await ini.count()){await ini.first().click(); await pg.waitForTimeout(1500);
   const nao=pg.getByRole('button',{name:'Agora não'}); if(await nao.count()){await shot('sessao-alarme-exato'); await nao.first().click(); await pg.waitForTimeout(500);}
   await shot('sessao-timer-rodando');}
 const prof=pg.getByRole('button',{name:/Professor|professor/}); if(await prof.count()){await prof.first().click(); await pg.waitForTimeout(900); await pg.screenshot({path:`${out}/sessao-chat-${scheme}-${sn}.png`}); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);}
 const enc=pg.getByRole('button',{name:/^Encerrar/}); if(await enc.count()){await enc.first().click(); await pg.waitForTimeout(600); await pg.screenshot({path:`${out}/sessao-encerrar-dialogo-${scheme}-${sn}.png`});}
 if(sn==='360'){ const small=await pg.$$eval('button,a,[role=button],input,select',els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<48||r.width<48)}).map(e=>`${(e.innerText||e.getAttribute('aria-label')||e.tagName).trim().slice(0,30)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
  log.push(`${scheme} alvos<48px /sessao: ${small.length} ${small.slice(0,6).join(' | ')}`);}
 await ctx.close();
}
await b.close(); srv.close(); fs.writeFileSync(out+'/log.txt',log.join('\n')); console.log(log.join('\n'));
