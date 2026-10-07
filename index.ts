export interface Env { AI?: Ai; ASSETS?: Fetcher; DB?: D1Database; }
type Msg={role:"system"|"user"|"assistant";content:string};
const SYSTEM=`You are Global AI Mahlet, a global-first AI assistant. Serve people worldwide while providing strong Ethiopian and African context, especially Amharic and Tigrinya. Be honest: never claim a tool, search, file, image, voice service, API, or action was used unless it actually was.`;
const j=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
export default {async fetch(req:Request,env:Env){
 const u=new URL(req.url);
 if(u.pathname==="/api/health") return j({ok:true,app:"Global AI Mahlet",categories:29,pricingCategoryIncluded:false,workersAI:Boolean(env.AI)});
 if(u.pathname==="/api/chat"&&req.method==="POST"){
  try{
   const b=await req.json() as {messages?:Msg[]}; const messages=b.messages||[];
   if(!messages.length)return j({error:"messages required"},400);
   if(!env.AI)return j({text:"The Global AI Mahlet interface is ready, but Workers AI is not bound yet. Configure the AI binding in Cloudflare before testing real chat.",model:"unconfigured"});
   const r:any=await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8",{messages:[{role:"system",content:SYSTEM},...messages]});
   return j({text:r?.response??String(r??""),model:"@cf/meta/llama-3.1-8b-instruct-fp8"});
  }catch(e){return j({error:e instanceof Error?e.message:"Chat failed"},500)}
 }
 if(u.pathname.startsWith("/api/"))return j({error:"Not found"},404);
 if(env.ASSETS)return env.ASSETS.fetch(req);
 return new Response("Configure the ASSETS binding for the public app.",{status:503});
}};