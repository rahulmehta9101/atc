import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFeed,normalize,REFRESH_MS,SYMBOLS} from './feed.mjs';
test('reject invalid quotes; never invent quote timestamp',()=>{
 for(const lp of [null,0,-1,Infinity,'94'])assert.throws(()=>normalize({lp},0));
 assert.equal(normalize({lp:94,ch:-1},0).pv,95);
 assert.equal(normalize({lp:94},0).t,null);
});
test('share concurrent calls, cache 15 minutes, retain stale prices on partial failure and recover',async()=>{
 let now=1000,calls=0,fail=false;
 const feed=createFeed(async({symbol})=>{calls++;if(fail&&symbol==='TVC:USOIL')throw Error();return {lp:90,prev_close_price:91,lp_time:1700000000}},()=>now);
 await Promise.all([feed(),feed()]);assert.equal(calls,Object.keys(SYMBOLS).length);
 now+=REFRESH_MS-1;await feed();assert.equal(calls,Object.keys(SYMBOLS).length);
 now++;fail=true;let data=await feed();assert.equal(calls,Object.keys(SYMBOLS).length*2);assert.equal(data.prices.wti.stale,true);assert.equal(data.prices.brent.stale,false);assert(data.errors.wti);
 now+=60000;fail=false;data=await feed();assert.equal(data.prices.wti.stale,false);assert.deepEqual(data.errors,{});
});

test('ICE cotton is requested and a failed update retains its last quote as stale',async()=>{
 let now=1000,fail=false;const requested=[];
 const feed=createFeed(async({symbol})=>{requested.push(symbol);if(fail&&symbol==='ICEUS:CT1!')throw Error('unavailable');return {lp:78.16,prev_close_price:78.06,lp_time:1700000000}},()=>now);
 let data=await feed();assert(requested.includes('ICEUS:CT1!'));assert.equal(data.prices.cotton.v,78.16);
 now+=REFRESH_MS;fail=true;data=await feed();assert.equal(data.prices.cotton.stale,true);assert(data.errors.cotton);assert.equal(data.prices.brent.stale,false);
});
