export const SYMBOLS = {brent:'TVC:UKOIL',wti:'TVC:USOIL',usdinr:'FX_IDC:USDINR',cotton:'ICEUS:CT1!'};
export const REFRESH_MS = 15 * 60 * 1000;
export function normalize(q, now) {
  if(typeof q?.lp !== 'number' || !Number.isFinite(q.lp) || q.lp <= 0) throw new Error('INVALID_PRICE');
  const previous = q.prev_close_price ?? (typeof q.ch === 'number' ? q.lp-q.ch : null);
  const time = typeof q.lp_time === 'number' && q.lp_time > 0 ? new Date(q.lp_time*1000) : null;
  return {v:q.lp,pv:Number.isFinite(previous)&&previous>0?previous:null,
    t:time && Number.isFinite(time.getTime())?time.toISOString():null,
    checkedAt:new Date(now).toISOString(),s:'TradingView (indicative)',kind:'api',stale:false};
}
export function createFeed(getQuote, clock=Date.now) {
  let prices={},errors={},next=0,pending;
  async function refresh() {
    const now=clock();const nextErrors={};
    await Promise.all(Object.entries(SYMBOLS).map(async ([key,symbol])=>{
      try {prices[key]=normalize(await getQuote({symbol,timeoutMs:12000}),now);}
      catch {nextErrors[key]='Quote unavailable';if(prices[key]) prices[key]={...prices[key],stale:true};}
    }));
    errors=nextErrors;next=clock()+(Object.keys(errors).length?60000:REFRESH_MS);
  }
  return async function read() {
    if(clock()>=next && !pending) pending=refresh().finally(()=>{pending=null;});
    if(pending) await pending;
    return {prices:structuredClone(prices),errors:{...errors}};
  };
}
