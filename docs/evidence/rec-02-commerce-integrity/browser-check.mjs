if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Set PLAYWRIGHT_MODULE to the existing Playwright module file URL');
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE);
import fs from 'node:fs';import assert from 'node:assert/strict';
const out='docs/evidence/rec-02-commerce-integrity';const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));const queries=[];p.on('response',r=>{if(r.url().includes('/admin/payments?'))queries.push({url:r.url(),status:r.status()});});
try{
await p.goto('http://127.0.0.1:5197/admin/payments?page=1&search=Alpha');await p.getByRole('heading',{name:'Alpha Reference',exact:true}).first().waitFor();
for(const [name,size] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 await p.setViewportSize(size);await p.waitForTimeout(300);await p.getByLabel('Search payments',{exact:true}).fill('Alpha');await p.waitForURL(u=>u.searchParams.get('search')==='Alpha');await p.waitForFunction(()=>![...document.querySelectorAll('h3')].some(e=>e.textContent==='Beta Reference'));await p.getByRole('heading',{name:'Alpha Reference',exact:true}).first().waitFor();await p.screenshot({path:`${out}/${name}-nonempty.png`});
 await p.getByLabel('Search payments',{exact:true}).fill('Beta');await p.getByRole('heading',{name:'Beta Reference',exact:true}).first().waitFor();await p.waitForFunction(()=>![...document.querySelectorAll('h3')].some(e=>e.textContent==='Alpha Reference'));assert.equal(await p.getByRole('heading',{name:'Alpha Reference',exact:true}).count(),0);
 await p.getByLabel('Search payments',{exact:true}).fill('REC02-no-match-record');await p.getByText('No payments match the current search and filters.').waitFor();await p.screenshot({path:`${out}/${name}-no-match.png`});
 await p.getByRole('button',{name:'Clear search payments'}).click();await p.waitForURL(u=>!u.searchParams.has('search'));await p.getByRole('heading',{name:'Beta Reference',exact:true}).first().waitFor();await p.getByRole('heading',{name:'Alpha Reference',exact:true}).first().waitFor();await p.screenshot({path:`${out}/${name}-clear-recovery.png`});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
}
assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/browser-results.json`,JSON.stringify({passed:true,route:'/admin/payments',viewports:['1440x1000','390x844'],data:'Actual payment router and disposable PostgreSQL records, not response stubs',authentication:'Synthetic staff principal and capability store via local test harness, not full login/MFA evidence',queries,errors},null,2));console.log('Browser passed: A to B, no-match, clear, responsive composition, real isolated API/DB');
}finally{await b.close();}
