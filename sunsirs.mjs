import {load} from 'cheerio';
export const SOURCES={
 pta:{commodity:'PTA',url:'https://www.sunsirs.com/uk/prodetail-356.html'},
 meg:{commodity:'Ethylene glycol',url:'https://www.sunsirs.com/uk/prodetail-222.html'}
};
// Published observations verified from the source pages on 29 October 2026.
// These are dated fallback snapshots, never represented as a successful live fetch.
export const SAVED_DAILY={
 pta:{v:7299.25,pv:7228.50,t:'2026-10-28'},
 meg:{v:5766.67,pv:5733.33,t:'2026-10-28'}
};
export function parseDaily(html,key,now=Date.now()){
 const source=SOURCES[key];if(!source)throw new Error('UNKNOWN_COMMODITY');
 if(/HW_CHECK|正在进行安全检查|captcha/i.test(html))throw new Error('SOURCE_SECURITY_CHECK');
 const $=load(html);const records=new Map();
 $('tr').each((_,row)=>{
  const cells=$(row).find('td').toArray().map(td=>$(td).text().replace(/\s+/g,' ').trim());
  if(cells.length!==4||cells[0].toLowerCase()!==source.commodity.toLowerCase())return;
  const [, ,raw,date]=cells;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(raw))return;
  const parsed=new Date(date+'T00:00:00Z'),v=Number(raw.replaceAll(',',''));
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||parsed.getTime()>now+86400000||!Number.isFinite(v)||v<=0)return;
  if(records.has(date)&&records.get(date)!==v)throw new Error('CONFLICTING_DAILY_ROWS');
  records.set(date,v);
 });
 const rows=[...records].sort((a,b)=>b[0].localeCompare(a[0]));
 if(!rows.length)throw new Error('DAILY_TABLE_UNAVAILABLE');
 return {v:rows[0][1],pv:rows[1]?.[1]??null,t:rows[0][0],s:'SunSirs',kind:'daily',stale:false,checkedAt:new Date(now).toISOString()};
}
export async function fetchDaily(key,now=Date.now(),fetcher=fetch){
 const r=await fetcher(SOURCES[key].url,{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}});
 if(!r.ok)throw new Error('SOURCE_HTTP_'+r.status);
 return parseDaily(await r.text(),key,now);
}
export function createDailyFeed(fetcher=fetchDaily,clock=Date.now){
 const prices=Object.fromEntries(Object.entries(SAVED_DAILY).map(([k,p])=>[k,{...p,s:'SunSirs',kind:'daily',stale:true,saved:true}]));
 let next=0,pending,errors={};
 return async function read(){
  if(clock()>=next&&!pending){
   pending=(async()=>{
    const failures={};
    await Promise.all(Object.keys(SOURCES).map(async key=>{
     try{
      const quote=await fetcher(key,clock());
      if(quote.t<prices[key].t)throw new Error('OLDER_SOURCE_DATE');
      prices[key]={...quote,saved:false};
     }catch(e){prices[key]={...prices[key],stale:true};failures[key]=e.message==='SOURCE_SECURITY_CHECK'?'SunSirs security check; automatic refresh unavailable':'SunSirs daily update unavailable';}
    }));
    errors=failures;next=clock()+15*60*1000;
   })().finally(()=>{pending=null});
  }
  if(pending)await pending;
  return {prices:structuredClone(prices),errors:{...errors}};
 };
}
