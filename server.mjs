import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {getQuote} from '@mathieuc/tradingview/data';
import {createFeed} from './feed.mjs';
import {createDailyFeed} from './sunsirs.mjs';
import {sendEnquiryToAppsScript,validateEnquiry} from './enquiry.mjs';
const tradingFeed=createFeed(getQuote),dailyFeed=createDailyFeed();
const scriptUrl=process.env.GOOGLE_APPS_SCRIPT_URL||'https://script.google.com/macros/s/AKfycbwuGKfka3I9eyHF8MH00FfBWHXVFl9Xut_5HgVbIF4aF_8G0DXiibGLfz7T4a9s1zN8/exec';
const scriptToken=process.env.GOOGLE_APPS_SCRIPT_TOKEN||'';
let enquiryConfig=null;
if(scriptUrl&&scriptToken){
  try{
    const url=new URL(scriptUrl);
    if(url.protocol==='https:'&&url.hostname==='script.google.com'&&/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)){
      enquiryConfig={url:scriptUrl,token:scriptToken};
    }else console.error('Google Sheets enquiry integration is disabled: GOOGLE_APPS_SCRIPT_URL must be a deployed HTTPS Apps Script /exec URL.');
  }catch{console.error('Google Sheets enquiry integration is disabled: GOOGLE_APPS_SCRIPT_URL is invalid.');}
}else if(scriptUrl||scriptToken)console.error('Google Sheets enquiry integration is disabled: configure both GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_TOKEN.');
else console.error('Google Sheets enquiry integration is not configured; submissions will be rejected until deployment credentials are set.');
async function feed(){
 const [market,daily]=await Promise.all([tradingFeed(),dailyFeed()]);
 return {prices:{...market.prices,...daily.prices},errors:{...market.errors,...daily.errors}};
}
const pageTemplate=await readFile(new URL('./public/index.html',import.meta.url),'utf8');
const page=pageTemplate;
const imageNames=[...["godown","dispatch"].flatMap(kind=>[1,2,3].map(n=>`${kind}-${n}.png`)),...["polyester","cotton","blended"].flatMap(kind=>[1,2,3].map(n=>`yarn-${kind}-${n}.svg`))];
const godownAssets=new Map(await Promise.all(imageNames.map(async name=>[
  `/images/${name}`,await readFile(new URL(`./public/images/${name}`,import.meta.url))
])));
const enquiryRequests=new Map();
const enquiryWindowMs=10*60*1000,enquiryLimit=5,maxEnquiryBytes=16*1024;
function sendJson(res,status,data){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
function rateLimited(ip,now=Date.now()){
  for(const [key,times] of enquiryRequests)if(times.every(time=>now-time>=enquiryWindowMs))enquiryRequests.delete(key);
  const times=(enquiryRequests.get(ip)||[]).filter(time=>now-time<enquiryWindowMs);
  if(times.length>=enquiryLimit){enquiryRequests.set(ip,times);return true;}
  times.push(now);enquiryRequests.set(ip,times);return false;
}
function readJson(req){
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0,tooLarge=false;
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>maxEnquiryBytes){tooLarge=true;chunks.length=0;return;}
      if(!tooLarge)chunks.push(chunk);
    });
    req.on('end',()=>{
      if(tooLarge){const error=new Error('The enquiry is too large.');error.status=413;reject(error);return;}
      try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
      catch{const error=new Error('The enquiry data is not valid JSON.');error.status=400;reject(error);}
    });
    req.on('error',reject);
  });
}
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/enquiry'){
    if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'});return res.end();}
    if(!enquiryConfig)return sendJson(res,503,{ok:false,error:'Google Sheets saving is not configured yet. Your enquiry was not saved; please contact dme@abhaytrading.in.'});
    if(rateLimited(req.socket.remoteAddress||'unknown'))return sendJson(res,429,{ok:false,error:'Too many enquiries. Please wait a few minutes and try again.'});
    let enquiry;
    try{enquiry=validateEnquiry(await readJson(req));}
    catch(error){return sendJson(res,error.status||400,{ok:false,error:error.message});}
    try{
      const result=await sendEnquiryToAppsScript(enquiry,enquiryConfig);
      return sendJson(res,200,{ok:true,...result});
    }catch(error){
      console.error('Enquiry forwarding failed:',error);
      return sendJson(res,502,{ok:false,error:'Your enquiry could not be saved. Please try again or email dme@abhaytrading.in.'});
    }
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  if(path==='/api/prices'){
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
    try {const data=await feed();res.writeHead(Object.keys(data.prices).length?200:503);res.end(JSON.stringify(data));}
    catch {res.writeHead(503);res.end(JSON.stringify({prices:{},errors:{feed:'Unavailable'}}));}
  }else if(godownAssets.has(path)){
    res.setHeader('Content-Type',path.endsWith('.svg')?'image/svg+xml':'image/png');res.setHeader('Cache-Control','public, max-age=3600');
    res.end(req.method==='HEAD'?undefined:godownAssets.get(path));
  }else if(path==='/'||path==='/index.html'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.method==='HEAD'?undefined:page);
  }else {res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Website ready; open http://localhost:'+(process.env.PORT||3000)));
