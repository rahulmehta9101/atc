import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDaily,createDailyFeed,fetchDaily} from './sunsirs.mjs';
const now=Date.parse('2026-10-29T12:00:00Z');
const row=(name,value,date)=>`<tr><td><a>${name}</a></td><td>Textile</td><td>${value}</td><td>${date}</td></tr>`;
test('extracts correct commodity, sorts dates, ignores duplicates and keeps publication date',()=>{
 const html='<table>'+row('PTA','7,228.50','2026-10-27')+row('PTA','7299.25','2026-10-28')+row('PTA','7299.25','2026-10-28')+row('Ethylene glycol','5766.67','2026-10-28')+'</table>';
 const q=parseDaily(html,'pta',now);assert.equal(q.v,7299.25);assert.equal(q.pv,7228.5);assert.equal(q.t,'2026-10-28');assert.equal(q.kind,'daily');
 assert.equal(parseDaily(html,'meg',now).v,5766.67);
});
test('security checks and malformed or mismatched pages never become quotes',()=>{
 for(const html of ['<script>HW_CHECK</script>','<table>'+row('PTA','0','2026-10-28')+'</table>','<table>'+row('Cotton','7299','2026-10-28')+'</table>','<table>'+row('PTA','9000','2026-02-30')+'</table>'])assert.throws(()=>parseDaily(html,'pta',now));
});
test('partial failure, cache, recovery, and old-source protection',async()=>{
 let t=now,calls=0,fail=true,old=false;
 const read=createDailyFeed(async key=>{calls++;if(fail&&key==='pta')throw Error('SOURCE_SECURITY_CHECK');return {v:7300,pv:7200,t:old?'2026-10-27':'2026-10-29',kind:'daily',s:'SunSirs',stale:false}},()=>t);
 const [a]=await Promise.all([read(),read()]);assert.equal(calls,2);assert.equal(a.prices.pta.stale,true);assert.equal(a.prices.pta.t,'2026-10-28');assert.equal(a.prices.meg.stale,false);assert.match(a.errors.pta,/security check/);
 t+=899999;await read();assert.equal(calls,2);t++;fail=false;const b=await read();assert.equal(b.prices.pta.stale,false);assert.equal(b.prices.pta.t,'2026-10-29');
 t+=900000;old=true;const c=await read();assert.equal(c.prices.pta.t,'2026-10-29');assert.equal(c.prices.pta.stale,true);
});
test('default clock works and a failed request retains explicitly stale saved data',async()=>{
 const read=createDailyFeed(async()=>{throw Error('offline')});
 const data=await read();assert.equal(data.prices.pta.saved,true);assert.equal(data.prices.pta.stale,true);assert(data.errors.meg);
});
test('HTTP errors are rejected',async()=>{await assert.rejects(fetchDaily('pta',now,async()=>({ok:false,status:403})),/403/)});
