import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{env:{...process.env,APP_ENV:'development',DATABASE_URL:'',AI_ASSISTANTS_ORIGIN:'http://localhost:3100',AI_ASSISTANTS_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
try {
 for(let i=0;i<150&&!logs.includes('Ready');i++){if(server.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,100));}
 let count=0;
 for(const [path,status] of [['/',200],['/plans',200],['/how-it-works',200],['/help',200],['/help/website',200],['/faq',200],['/terms',200],['/privacy',200],['/login',200],['/register',200],['/account',307],['/ai-assistants',307],['/assistant-portal/account',307],['/api/admin/stores',404],['/not-a-real-page',404],['/robots.txt',200],['/assistant-widget.js',200]]) {
  const r=await fetch('http://localhost:3100'+path,{redirect:'manual'});assert.equal(r.status,status,`${path}: ${await r.clone().text()}`);if(path==='/')assert.match(await r.text(),/ai-shell/);count++;
 }
 const store=await fetch('http://127.0.0.1:3100/');assert.equal(store.status,200);const html=await store.text();assert.match(html,/data-store="tapkin"/);assert.doesNotMatch(html,/ai-shell/);count++;
 console.log(`${count} assistant/store HTTP checks passed`);
} catch(error){console.error(logs.slice(-10000));throw error;} finally {server.kill('SIGTERM');}
