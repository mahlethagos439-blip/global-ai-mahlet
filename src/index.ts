interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  ANALYTICS?: AnalyticsEngineDataset;
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OWNER_EMAIL?: string;
  APP_ORIGIN?: string;
}

interface Ai {
  run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<any>;
}

interface AnalyticsEngineDataset {
  writeDataPoint(data: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

interface ChatMessage {
  role?: string;
  content?: string;
  text?: string;
}

interface MemoryItem {
  id?: string;
  text?: string;
}

interface BusinessProfile {
  company?: string;
  role?: string;
  goal?: string;
  tone?: string;
}

interface RequestBody {
  message?: string;
  language?: string;
  image?: string;
  imageName?: string;
  messages?: ChatMessage[];
  memories?: MemoryItem[];
  businessProfile?: BusinessProfile;
  webSearch?: boolean;
  event?: string;
}

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const VISION_FALLBACK_MODEL = "@cf/qwen/qwen3.8-27b";

// Qwen 3.8 27B is a native Image-Text-to-Text model on Workers AI.
// Keep the Llama license flag only for the fallback path.
let visionLicenseAgreed = false;
const SEARCH_MODEL = "openai/gpt-4o-mini";

function shouldUseWebSearchServer(text:string):boolean{
  const q=String(text||"").trim().toLowerCase();
  if(!q)return false;
  // Personal conversation and vague openers must never trigger search just because they are long.
  if(/^(hi+|hey+|hello+|hii+|good morning|good afternoon|good evening|thanks|thank you|ok|okay|yes|no|sure|great|nice|bye|goodbye|i have (one )?(a )?problem( today)?|i need help|can you help me|help me|i have a question|i want to ask (you )?(a )?question|something happened|are you there)[.!?\s]*$/i.test(q))return false;
  if(/^(i am|i'm|im)\s+(sad|crying|cry|scared|afraid|worried|stressed|tired|hurt|lonely|overwhelmed|not okay|not ok)\b/i.test(q))return false;
  // Search on explicit request.
  if(/\b(search the web|search online|search the internet|web search|browse the web|research online|find online|look up online|look this up|search for sources|find sources|give me sources|show me sources|find me (?:real )?(?:photos?|images?|pictures?)|search)\b/.test(q))return true;
  if(/\b(find|give|show|send|get|provide)\s+(me\s+)?(the\s+)?(official\s+)?(website|link|source|sources|article|articles|photos|images|pictures)\b/.test(q))return true;
  if(/\bofficial\s+(website|page|site|source)\b/.test(q))return true;
  // Current facts only trigger search when paired with a topic that benefits from live information.
  const liveTopic=/\b(weather|forecast|temperature|news|score|scores|match|game|schedule|price|prices|exchange rate|traffic|outage|power outage|stock|stocks|market|election|results|event|events|opening hours|hours|release|released|version|update|updates|availability|president|minister|university admission|scholarship deadline|school opening|earthquake|rainfall|currency)\b/.test(q);
  const timeSignal=/\b(latest|current|right now|as of|today|tonight|yesterday|this week|this month|recent|recently|breaking|live|forecast)\b/.test(q);
  return liveTopic || (timeSignal && /\b(what|who|when|where|which|how much|how many|tell me|is|are|will|did|has|have)\b/.test(q));
}

function json(
  data: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function recordEvent(
  env: Env,
  event: string,
  path: string,
  ok = true
) {
  try {
    env.ANALYTICS?.writeDataPoint({
      indexes: [
        event.slice(0, 96),
        path.slice(0, 96),
      ],
      blobs: [ok ? "ok" : "error"],
      doubles: [1],
    });
  } catch (error) {
    console.error("Analytics write failed:", error);
  }
}

function extractBase64Image(value: string): string {
  const text=String(value||"").trim();
  if(!text)return "";
  // Cloudflare's current Llama 3.2 Vision example accepts a data-URL image payload.
  // Keep the media-type prefix so the model knows how to decode the image.
  if(/^data:image\/[^;]+;base64,/i.test(text))return text;
  // Accept raw base64 as a fallback and normalize it to a JPEG data URL.
  if(/^[A-Za-z0-9+/=\s]+$/.test(text)){
    return "data:image/jpeg;base64,"+text.replace(/\s+/g,"");
  }
  return text;
}

type WebSource={title?:string;url?:string;image?:string;imageKind?:"og"|"favicon"};
type AnswerVisual={image?:string;thumbnail?:string;title?:string;url?:string;creator?:string;license?:string;licenseUrl?:string;provider?:string};

function buildVisualQuery(message:string, signals:{distress:boolean;celebration:boolean;encouragement:boolean;imageRequest:boolean}):string{
  const text=String(message||"").trim();
  if(signals.imageRequest){
    let query=text
      .replace(/\b(please|could you|can you|would you|i want you to|i need you to|for me)\b/gi," ")
      .replace(/^\s*(show|give|find|send|provide|get|fetch|display|search)\s+(me\s+)?/i,"")
      .replace(/^\s*(the\s+)?(?:an?\s+)?(?:actual|real|genuine|true)\s+(image|photo|photograph|picture|visual|illustration|diagram)\s+(of|about)\s+/i,"")
      .replace(/^\s*(?:an?|the)\s+(image|photo|photograph|picture|visual|illustration|diagram)\s+(of|about)\s+/i,"")
      .replace(/^\s*(image|photo|photograph|picture|visual|illustration|diagram)\s*(of|about)?\s*/i,"")
      .replace(/^\s*(of|about)\s+/i,"")
      .replace(/\b(right now|please|for me|to me)\b/gi," ")
      .replace(/[?!.]+$/g," ")
      .replace(/\s+/g," ")
      .trim();

    const ofMatch=text.match(/\b(?:of|about)\s+(.+?)(?:\s+(?:right now|please))?[?!.]*$/i);
    if(ofMatch?.[1])query=ofMatch[1].trim();

    query=query
      .replace(/\b(give|show|find|send|provide|get|fetch|display|search)\b/gi," ")
      .replace(/\b(me|the|an|a|please|actual|real|genuine|true)\b/gi,(m)=>/\b(actual|real|genuine|true)\b/i.test(m)?" ":m)
      .replace(/\s+/g," ").trim();

    if(!query || /^(it|this|that|something|anything|me)$/i.test(query))query=text;

    // A request for a named place should retrieve photographs of the physical
    // place, not merchandise, artwork, portraits, or objects merely associated
    // with it. Keep the entity name and add strong physical-place terms.
    if(/\b(university|college|campus|school|museum|airport|hospital|stadium|library|church|mosque|cathedral|monument|landmark|building|palace|bridge|tower)\b/i.test(query)){
      const named=query
        .replace(/\b(actual|real|genuine|true|photo|photograph|picture|image|visual|illustration)\b/gi," ")
        .replace(/\s+/g," ").trim();
      if(named){
        if(/\bharvard\b/i.test(named)) query="Harvard University campus Harvard Yard Massachusetts";
        else if(/\bmit\b|massachusetts institute of technology/i.test(named)) query="MIT campus Massachusetts Institute of Technology Cambridge";
        else if(/\bduke\b/i.test(named)) query="Duke University campus Durham North Carolina";
        else if(/\brice\b/i.test(named)) query="Rice University campus Houston Texas";
        else if(/\bcolumbia\b/i.test(named)) query="Columbia University campus New York City";
        else query=`${named} exterior campus building`; 
      }
    }
    return query.slice(0,160);
  }
  if(signals.distress)return text.slice(0,180)+" emotional support comfort supportive conversation";
  if(signals.celebration)return "celebration achievement success happy student";
  if(signals.encouragement)return "motivation studying student goal achievement";
  if(/\b(solar system|planet|planets|space|galaxy|star|moon|sun)\b/i.test(text))return text+" educational";
  if(/\b(photosynthesis|cell|biology|anatomy|human body|chemistry|chemical|physics|electricity|magnet|gravity|atom|molecule|math|geometry|triangle|algebra)\b/i.test(text))return text+" educational diagram";
  if(/\b(animal|bird|flower|plant|tree|ocean|mountain|river|forest|nature|country|city|landmark|museum)\b/i.test(text))return text+" photo";
  if(/\b(code|coding|programming|software|computer|robot|artificial intelligence|AI)\b/i.test(text))return text+" technology";
  if(text.length >= 18 && !/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|good morning|good evening|how are you)[.!?\s]*$/i.test(text)){
    return text.slice(0,180)+" relevant educational or contextual photo illustration";
  }
  return "";
}

function buildVisualQueries(message:string, signals:{distress:boolean;celebration:boolean;encouragement:boolean;imageRequest:boolean}):string[]{
  const raw=String(message||"").trim();
  if(!raw || !signals.imageRequest) return [];
  // Split compound photo requests into separate subjects so each requested
  // subject receives its own search rather than one mixed, unreliable query.
  const pieces=raw.split(/\s+(?:and|&)\s+(?=(?:(?:the|a|an)\s+)?(?:real\s+)?(?:image|photo|photograph|picture|images|photos|photographs|pictures)\s+(?:of|about)\b)/i)
    .map(x=>x.trim()).filter(Boolean);
  const candidates=pieces.length>1?pieces:[raw];
  const queries:string[]=[];
  for(const part of candidates){
    const q=buildVisualQuery(part,signals);
    if(q && !queries.some(old=>old.toLowerCase()===q.toLowerCase()))queries.push(q);
  }
  return queries.slice(0,4);
}

function cleanVisualText(value:any):string{
  return String(value?.value??value??"").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
}

function isPhysicalPlaceVisual(query:string, title:string, description:string):boolean{
  const q=query.toLowerCase();
  const searchable=(title+" "+description).toLowerCase();
  const qTerms=q.split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !/^(photo|photograph|picture|image|visual|campus|building|university|college|school|the|of|in|and|yard|city|massachusetts|north|carolina|texas)$/i.test(t));
  const entityHit=qTerms.length===0 || qTerms.some(t=>searchable.includes(t));
  const physicalHit=/\b(campus|yard|building|hall|library|quad|courtyard|gate|tower|entrance|exterior|street|view|aerial|grounds|facade|front|school|university|college)\b/i.test(searchable);
  const badHit=/\b(statue|sculpture|portrait|painting|artwork|costume|gown|robe|medal|bust|museum object|artifact|book cover|logo|seal|flag|shirt|merchandise|football player|basketball player)\b/i.test(searchable);
  return entityHit && physicalHit && !badHit;
}

async function fetchWikimediaVisuals(query:string):Promise<AnswerVisual[]>{
  if(!query)return [];
  try{
    const endpoint=new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.searchParams.set("action","query");
    endpoint.searchParams.set("generator","search");
    endpoint.searchParams.set("gsrsearch",query.replace(/\s+/g," ").trim().slice(0,160));
    endpoint.searchParams.set("gsrnamespace","6");
    endpoint.searchParams.set("gsrlimit","50");
    endpoint.searchParams.set("prop","imageinfo");
    endpoint.searchParams.set("iiprop","url|extmetadata");
    endpoint.searchParams.set("iiurlwidth","1200");
    endpoint.searchParams.set("format","json");
    endpoint.searchParams.set("origin","*");

    const response=await fetch(endpoint.href,{headers:{"Accept":"application/json","User-Agent":"GlobalAIMahlet/1.1"},redirect:"follow"});
    if(!response.ok)return [];
    const data:any=await response.json();
    const pages=Object.values(data?.query?.pages||{}) as any[];
    const isPlaceQuery=/\b(university|college|campus|school|museum|airport|hospital|stadium|library|church|mosque|cathedral|monument|landmark|building|palace|bridge|tower)\b/i.test(query);
    const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !/^(photo|photograph|picture|image|visual|campus|building|university|college|school|the|of|in|and|yard|city|massachusetts|north|carolina|texas)$/i.test(t));
    const ranked=pages.map((item,index)=>{
      const title=String(item?.title||"").replace(/^File:/i,"");
      const meta=item?.imageinfo?.[0]?.extmetadata||{};
      const description=cleanVisualText(meta?.ImageDescription);
      const searchable=(title+" "+description).toLowerCase();
      const entityMatches=terms.reduce((n,t)=>n+(searchable.includes(t)?1:0),0);
      const exactPhrase=/harvard\s+university/i.test(query)&&/harvard\s+university/i.test(searchable)?5:0;
      const physical=/\b(campus|yard|hall|library|quad|courtyard|gate|tower|entrance|exterior|street|view|aerial|grounds|facade|front|school|university|college)\b/i.test(searchable)?4:0;
      const bad=/\b(statue|sculpture|portrait|painting|artwork|costume|gown|robe|medal|bust|artifact|book cover|logo|seal|flag|shirt|merchandise|player|map|maps|diagram|floor plan|site plan|campus map|location map)\b/i.test(searchable)?-14:0;
      const placeValid=!isPlaceQuery || isPhysicalPlaceVisual(query,title,description);
      return {item,index,score:entityMatches*3+exactPhrase+physical+bad,placeValid};
    }).filter(x=>x.placeValid && (!isPlaceQuery || x.score>0))
      .sort((a,b)=>b.score-a.score||a.index-b.index);

    const visuals:AnswerVisual[]=[]; const seen=new Set<string>();
    for(const row of ranked){
      const info=row.item?.imageinfo?.[0];
      const image=typeof info?.thumburl==="string"?info.thumburl:(typeof info?.url==="string"?info.url:"");
      if(!image||seen.has(image))continue;
      seen.add(image);
      const meta=info?.extmetadata||{};
      const title=String(row.item?.title||"Related photo").replace(/^File:/i,"").replace(/\.[a-z0-9]+$/i,"").trim();
      visuals.push({image,thumbnail:image,title:title||"Related photo",url:typeof info?.descriptionurl==="string"?info.descriptionurl:"",creator:cleanVisualText(meta?.Artist),license:cleanVisualText(meta?.LicenseShortName),licenseUrl:cleanVisualText(meta?.LicenseUrl),provider:"Wikimedia Commons"});
      if(visuals.length>=4)break;
    }
    return visuals;
  }catch(error){console.warn("Wikimedia visual search failed:",error);return []}
}

async function fetchOpenverseVisuals(query:string):Promise<AnswerVisual[]>{
  if(!query)return [];
  try{
    const endpoint=new URL("https://api.openverse.org/v1/images/");
    endpoint.searchParams.set("q",query.replace(/\s+/g," ").trim().slice(0,180));
    endpoint.searchParams.set("page_size","50");
    const response=await fetch(endpoint.href,{method:"GET",redirect:"follow",headers:{"Accept":"application/json","User-Agent":"GlobalAIMahlet/1.1"}});
    if(!response.ok)return [];
    const data:any=await response.json();
    const results=Array.isArray(data?.results)?data.results:[];
    const isPlaceQuery=/\b(university|college|campus|school|museum|airport|hospital|stadium|library|church|mosque|cathedral|monument|landmark|building|palace|bridge|tower)\b/i.test(query);
    const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !/^(photo|photograph|picture|image|visual|campus|building|university|college|school|the|of|in|and|yard|city|massachusetts|north|carolina|texas)$/i.test(t));
    const ranked=results.map((item:any,index:number)=>{
      const title=typeof item?.title==="string"?item.title:"";
      const tags=Array.isArray(item?.tags)?item.tags.map((tag:any)=>typeof tag==="string"?tag:String(tag?.name||"")).join(" "):"";
      const desc=typeof item?.description==="string"?item.description:"";
      const searchable=(title+" "+tags+" "+desc).toLowerCase();
      const entityMatches=terms.reduce((n,t)=>n+(searchable.includes(t)?1:0),0);
      const physical=/\b(campus|yard|hall|library|quad|courtyard|gate|tower|entrance|exterior|street|view|aerial|grounds|facade|front|school|university|college)\b/i.test(searchable)?4:0;
      const bad=/\b(statue|sculpture|portrait|painting|artwork|costume|gown|robe|medal|bust|artifact|book cover|logo|seal|flag|shirt|merchandise|player|map|maps|diagram|floor plan|site plan|campus map|location map)\b/i.test(searchable)?-14:0;
      return {item,index,score:entityMatches*3+physical+bad,valid:!isPlaceQuery || (entityMatches>0 && physical>0 && bad===0)};
    }).filter((x:any)=>x.valid && x.score>0).sort((a:any,b:any)=>b.score-a.score||a.index-b.index);
    const visuals:AnswerVisual[]=[]; const seen=new Set<string>();
    for(const row of ranked){
      const item=row.item; const image=typeof item?.url==="string"?item.url:""; const thumbnail=typeof item?.thumbnail==="string"?item.thumbnail:"";
      if(!image&&!thumbnail)continue; const key=image||thumbnail; if(seen.has(key))continue; seen.add(key);
      visuals.push({image,thumbnail,title:typeof item?.title==="string"&&item.title?item.title:"Related visual",url:typeof item?.foreign_landing_url==="string"?item.foreign_landing_url:"",creator:typeof item?.creator==="string"?item.creator:"",license:typeof item?.license==="string"?item.license:"",licenseUrl:typeof item?.license_url==="string"?item.license_url:"",provider:typeof item?.provider==="string"?item.provider:"Openverse"});
      if(visuals.length>=4)break;
    }
    return visuals;
  }catch(error){console.warn("Openverse visual search failed:",error);return []}
}

async function fetchRelevantVisuals(query:string):Promise<AnswerVisual[]>{
  const base=String(query||"").trim(); if(!base)return [];
  const place=/\b(university|college|campus|school|museum|airport|hospital|stadium|library|church|mosque|cathedral|monument|landmark|building|palace|bridge|tower)\b/i.test(base);
  let variants:string[];
  if(place){
    const lower=base.toLowerCase();
    if(/\bharvard\b/.test(lower)){
      // Prefer recognizable physical campus photographs instead of maps, logos,
      // documents, portraits, or other objects merely associated with Harvard.
      variants=[
        "Harvard Yard Harvard University campus real photo",
        "Widener Library Harvard University real photo",
        "Harvard University campus Massachusetts real photograph",
        "Harvard University campus exterior grounds real photo"
      ];
    }else if(/\bmit\b|massachusetts institute of technology/.test(lower)){
      variants=[
        "MIT campus Cambridge Massachusetts real photo",
        "Massachusetts Institute of Technology campus real photograph",
        "MIT Great Dome campus real photo"
      ];
    }else{
      variants=[base, `${base} exterior real photo`, `${base} grounds real photo`, `${base} building real photograph`];
    }
  }else{
    variants=[base, `${base} real photo`, `${base} real photograph`];
  }
  const seen=new Set<string>(); const collected:AnswerVisual[]=[];
  for(const q of variants){
    const wiki=await fetchWikimediaVisuals(q);
    for(const item of wiki){const key=item.image||item.thumbnail||item.url||"";if(!key||seen.has(key))continue;seen.add(key);collected.push(item);if(collected.length>=4)return collected;}
  }
  for(const q of variants){
    const openverse=await fetchOpenverseVisuals(q);
    for(const item of openverse){const key=item.image||item.thumbnail||item.url||"";if(!key||seen.has(key))continue;seen.add(key);collected.push(item);if(collected.length>=4)return collected;}
  }
  return collected;
}

function cleanAssistantAnswer(value:string):string{
  let text=String(value||"").replace(/\r/g,"").trim();

  // The UI renders image cards and source cards. Never expose the model's
  // internal image list, markdown image links, or raw URLs in the answer.
  text=text.replace(/!\[[^\]]*\]\([^)]*\)/g,"");
  text=text.replace(/\[\s*(?:Image|Photo|Picture|Photograph|Visual)\s*\d+[^\]]*\]\s*\([^)]*\)/gi,"");
  text=text.replace(/^\s*(?:Image|Photo|Picture|Photograph|Visual)\s*\d+\s*[:\-–—]?\s*[^\n]*(?:https?:\/\/\S+)?\s*$/gim,"");
  text=text.replace(/^\s*(?:Image|Photo|Picture|Photograph|Visual)\s*[:\-–—]\s*[^\n]*(?:https?:\/\/\S+)?\s*$/gim,"");
  text=text.replace(/^\s*https?:\/\/\S+\s*$/gim,"");
  text=text.replace(/\n?\s*(?:Sources?|References?)\s*:\s*[\s\S]*$/i,"");

  // Remove the common model-generated image-search preamble when it is
  // followed only by links. A short natural sentence is supplied by the UI.
  text=text.replace(/\b(?:Here are|Below are)\s+(?:some\s+)?(?:relevant|real|actual|matching)?\s*(?:real\s+)?(?:photos?|images?|pictures?|visuals?)\s*(?:of|for)[^\n]*:?\s*$/gim,"");
  text=text.replace(/^\s*Corrected Answer\s*:\s*/gim,"").trim();
  text=text.replace(/\n{3,}/g,"\n\n").trim();
  // Models sometimes repeat the same paragraph several times; keep the first copy only.
  const paragraphs=text.split(/\n\s*\n/).map((part:string)=>part.trim()).filter(Boolean);
  const seenParagraphs=new Set<string>();
  text=paragraphs.filter((part:string)=>{const key=part.toLowerCase().replace(/\s+/g," ");if(seenParagraphs.has(key))return false;seenParagraphs.add(key);return true;}).join("\n\n").trim();

  // Never replace a short, valid conversational answer with an unrelated image-search sentence.
  if(!text)return "I'm here to help. What would you like to know?";
  return text;
}

function detectResponseMood(signals:{distress:boolean;celebration:boolean;encouragement:boolean},message:string):string{
  if(signals.distress)return "caring";
  if(signals.celebration)return "excited";
  if(signals.encouragement)return "caring";
  if(/\b(why|how|explain|teach|learn|calculate|compare|analy[sz]e|step by step)\b/i.test(message))return "thinking";
  return "neutral";
}

function extractWebSearchSources(result:any): WebSource[] {
  const sources: WebSource[] = [];
  const seen = new Set<string>();

  const add = (title: unknown, url: unknown) => {
    if (typeof url !== "string" || !url) return;
    if (seen.has(url)) return;
    seen.add(url);
    sources.push({
      title: typeof title === "string" && title ? title : url,
      url,
    });
  };

  const output = Array.isArray(result?.output)
    ? result.output
    : Array.isArray(result?.result?.output)
      ? result.result.output
      : [];

  for (const item of output) {
    const annotations = item?.content?.flatMap?.((part: any) =>
      Array.isArray(part?.annotations) ? part.annotations : []
    ) || [];

    for (const annotation of annotations) {
      add(
        annotation?.title || annotation?.text,
        annotation?.url
      );
    }

    if (item?.type === "web_search_call") {
      const action = item?.action;
      const results = action?.sources || action?.results || [];
      if (Array.isArray(results)) {
        for (const source of results) {
          add(source?.title, source?.url);
        }
      }
    }
  }

  return sources.slice(0, 8);
}

function absoluteHttpUrl(value:string,baseUrl:string):string{
  try{const url=new URL(value,baseUrl);return url.protocol==="http:"||url.protocol==="https:"?url.href:""}catch{return ""}
}

function extractMetaImage(html:string,pageUrl:string):string{
  const patterns=[
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i
  ];
  for(const pattern of patterns){const match=html.match(pattern);if(match?.[1]){const u=absoluteHttpUrl(match[1].trim(),pageUrl);if(u)return u}}
  return "";
}

async function fetchOpenGraphImage(pageUrl:string):Promise<string>{
  try{
    const parsed=new URL(pageUrl);
    if(parsed.protocol!=="http:"&&parsed.protocol!=="https:")return "";
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),3500);
    const response=await fetch(parsed.href,{
      method:"GET",
      redirect:"follow",
      signal:controller.signal,
      headers:{
        "User-Agent":"Mozilla/5.0 (compatible; GlobalAIMahlet/1.0)",
        "Accept":"text/html,application/xhtml+xml"
      }
    });
    clearTimeout(timeout);
    if(!response.ok)return "";
    const html=(await response.text()).slice(0,350000);
    return extractMetaImage(html,parsed.href);
  }catch{
    return "";
  }
}

async function decorateWebSearchSources(sources:WebSource[]):Promise<WebSource[]>{
  const selected=sources.slice(0,8);
  const decorated=await Promise.all(selected.map(async source=>{
    let image=typeof source.image==="string"?source.image:"";
    let imageKind:WebSource["imageKind"] = image ? "og" : undefined;
    if(!image){
      image=await fetchOpenGraphImage(source.url||"");
      if(image)imageKind="og";
    }
    if(!image){
      try{
        const host=new URL(source.url||"").hostname;
        if(host){
          image="https://www.google.com/s2/favicons?domain="+encodeURIComponent(host)+"&sz=128";
          imageKind="favicon";
        }
      }catch{}
    }
    return {...source,...(image?{image}:{}) ,...(imageKind?{imageKind}:{})};
  }));
  return decorated;
}

function cleanWebSearchAnswer(value:string):string{
  let text=String(value||"").replace(/\r/g,"").trim();

  // Source links are rendered by the Global AI Mahlet UI, not inside the answer.
  // Remove source-list blocks and raw URL lines produced by fallback search.
  text=text.replace(/\n?\s*(?:Sources?|References?)\s*:\s*[\s\S]*$/i,"").trim();
  text=text.replace(/^[ \t]*\[?Source\s*\d+\]?\s*[:\-].*$/gim,"").trim();
  text=text.replace(/^[ \t]*URL\s*:\s*https?:\/\/\S+.*$/gim,"").trim();
  text=text.replace(/^[ \t]*https?:\/\/\S+\s*$/gim,"").trim();

  // Remove accidental search-process labels that should never be visible to the user.
  text=text.replace(/^[ \t]*(?:RETRIEVED(?:\s+(?:SOURCES?|RESULTS?))?|WEB RESULTS FOR INTERNAL GROUNDING)\s*:?[ \t]*$/gim,"").trim();
  text=text.replace(/^[ \t]*(?:LIVE WEB SEARCH RESULTS WERE RETRIEVED DIRECTLY FROM THE INTERNET\.?|WEB SEARCH RESULTS? WERE RETRIEVED[^\n]*\.?)[ \t]*$/gim,"").trim();

  // Remove empty lines left behind by the removed source block.
  text=text.replace(/\n{3,}/g,"\n\n").trim();
  return text;
}

function decodeHtmlEntities(value:string):string{
  return String(value||"")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/&#x27;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
}

function stripHtml(value:string):string{
  return decodeHtmlEntities(String(value||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());
}

function parseDirectSearchResults(html:string,baseUrl:string):Array<{title:string;url:string;snippet:string}> {
  const results:Array<{title:string;url:string;snippet:string}> = [];
  const seen=new Set<string>();

  const add=(title:string,url:string,snippet:string)=>{
    try{
      if(!url)return;
      let raw=decodeHtmlEntities(url);
      try{
        const parsed=new URL(raw,baseUrl);
        const redirected=parsed.searchParams.get("uddg")||parsed.searchParams.get("q");
        if(redirected && (/duckduckgo\.com\/l\/?/i.test(parsed.hostname+parsed.pathname)||/google\.com$/i.test(parsed.hostname))){
          raw=decodeURIComponent(redirected);
        }
      }catch{}
      const absolute=new URL(raw,baseUrl);
      if(absolute.protocol!=="http:"&&absolute.protocol!=="https:")return;
      if(/^(www\.)?(google|duckduckgo)\.com$/i.test(absolute.hostname) && !absolute.pathname.startsWith("/url"))return;
      const cleanUrl=absolute.href;
      if(seen.has(cleanUrl))return;
      const cleanTitle=stripHtml(title)||cleanUrl;
      const cleanSnippet=stripHtml(snippet);
      seen.add(cleanUrl);
      results.push({title:cleanTitle,url:cleanUrl,snippet:cleanSnippet});
    }catch{}
  };

  const blocks=html.match(/<div[^>]+class=["'][^"']*result[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi)||[];
  for(const block of blocks){
    const link=block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if(!link)continue;
    const snippet=block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    add(link[2],link[1],snippet?.[1]||"");
    if(results.length>=8)break;
  }

  if(results.length<3){
    const links=html.match(/<a[^>]+href=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi)||[];
    for(const tag of links){
      if(results.length>=8)break;
      const href=tag.match(/href=["']([^"']+)["']/i)?.[1]||"";
      const text=stripHtml(tag.replace(/^[\s\S]*?>/,"").replace(/<\/a>[\s\S]*$/i,""));
      if(!text||text.length<4)continue;
      add(text,href,"");
    }
  }

  return results.slice(0,8);
}

async function fetchDirectWebSearch(query:string){
  const encoded=encodeURIComponent(query.slice(0,500));
  const endpoints=[
    `https://html.duckduckgo.com/html/?q=${encoded}`,
    `https://www.google.com/search?q=${encoded}&hl=en&num=8`
  ];
  let lastError="";

  for(const endpoint of endpoints){
    try{
      const response=await fetch(endpoint,{
        headers:{
          "User-Agent":"Mozilla/5.0 (compatible; GlobalAIMahlet/1.0; +https://ethagos439.workers.dev)",
          "Accept":"text/html,application/xhtml+xml"
        },
        redirect:"follow"
      });
      if(!response.ok){
        lastError=`Search endpoint returned ${response.status}`;
        continue;
      }
      const html=await response.text();
      const results=parseDirectSearchResults(html,endpoint);
      if(results.length){
        return {results};
      }
      lastError="Search page returned no parseable results";
    }catch(error){
      lastError=error instanceof Error?error.message:String(error);
    }
  }

  throw new Error(`Direct web search failed: ${lastError||"no results"}`);
}

async function runDirectWebSearchWithAI(
  env:Env,
  systemPrompt:string,
  message:string
){
  const {results}=await fetchDirectWebSearch(message);
  const context=results.map((item,index)=>
    `[Source ${index+1}] ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet||"No snippet available."}`
  ).join("\n\n");

  const prompt=systemPrompt+
    `\n\nUse the web results below as your factual basis for this answer. `+
    `Answer the user's question directly and naturally. `+
    `Do not talk about the search process, retrieved results, source lists, or URLs. `+
    `Do not write a Sources/References section, [Source 1] labels, raw URLs, or markdown source links. `+
    `Do not tell the user to visit the sources just to verify the answer unless the user specifically asks for that. `+
    `If the available results genuinely conflict or do not contain enough information, briefly say that the information could not be verified instead of guessing. `+
    `The application will display the source cards separately at the very end of the message. `+
    `Keep the answer concise unless the user asks for detail.\n\n`+
    `WEB RESULTS FOR INTERNAL GROUNDING:\n${context}\n\nUSER REQUEST:\n${message}`;

  const result=await env.AI.run(
    TEXT_MODEL,
    {
      prompt: `System: ${prompt}\n\nUser: ${message}\n\nAssistant:`,
      max_tokens:1600,
      temperature:0.2
    }
  );

  return {result,sources:results};
}

async function runLiveWebSearch(env:Env,systemPrompt:string,message:string){
  try{
    const direct=await runDirectWebSearchWithAI(env,systemPrompt,message);
    return {result:direct.result,directSources:direct.sources};
  }catch(directError){
    console.error("Direct live web search failed; trying AI web-search fallback:",directError);
  }

  const input=systemPrompt+
    "\n\nLIVE WEB SEARCH IS REQUIRED. Search first and answer only from information actually retrieved. Do not invent current facts or sources. Do not print URLs or a Sources section because the UI renders source cards separately.\n\nUSER REQUEST:\n"+
    message;
  const request={input,max_output_tokens:2000,tools:[{type:"web_search_preview"}]};
  try{
    const result=await env.AI.run("openai/gpt-4o-mini",request,{gateway:{id:"default",skipCache:true}});
    const sources=extractWebSearchSources(result);
    if(!sources.length)throw new Error("AI web-search fallback returned no source annotations");
    return {result,directSources:[] as WebSource[]};
  }catch(error){
    console.error("All live web-search paths failed:",error);
    throw new Error("Real web search could not be completed right now. Please try again in a moment.");
  }
}


function cookie(request: Request, key: string): string | null {
  const raw=request.headers.get("Cookie")||"";
  for(const part of raw.split(";")){const i=part.indexOf("=");if(i>0&&part.slice(0,i).trim()===key)return decodeURIComponent(part.slice(i+1).trim());}
  return null;
}
function randomHex(n=32): string { const a=new Uint8Array(n);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,"0")).join(""); }
async function hashText(s:string):Promise<string>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function secureJson(data:unknown,status=200,headers:Record<string,string>={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});}
async function signedIn(request:Request,env:Env):Promise<{id:string;email:string;name:string}|null>{if(!env.DB)return null;const token=cookie(request,"gam_session");if(!token)return null;return await env.DB.prepare("SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1").bind(await hashText(token),Math.floor(Date.now()/1000)).first<{id:string;email:string;name:string}>();}
async function accountRoutes(request:Request,env:Env,url:URL):Promise<Response|null>{
 const path=url.pathname;if(!path.startsWith("/api/auth/")&&path!=="/api/feedback"&&path!=="/api/owner/feedback"&&path!=="/api/chats/sync")return null;
 if(!env.DB)return secureJson({error:"Account storage is not configured. Create and bind the D1 database, then run the migration."},503);
 const origin=(env.APP_ORIGIN||new URL(request.url).origin).replace(/\/$/,"");
 if(path==="/api/auth/google"&&request.method==="GET"){
  if(!env.GOOGLE_CLIENT_ID)return secureJson({error:"Google sign-in is not configured yet."},503);
  const state=randomHex(24),u=new URL("https://accounts.google.com/o/oauth2/v2/auth");u.searchParams.set("client_id",env.GOOGLE_CLIENT_ID);u.searchParams.set("redirect_uri",origin+"/api/auth/google/callback");u.searchParams.set("response_type","code");u.searchParams.set("scope","openid email profile");u.searchParams.set("state",state);u.searchParams.set("prompt","select_account");
  return new Response(null,{status:302,headers:{Location:u.toString(),"Set-Cookie":`gam_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=600`,"Cache-Control":"no-store"}});
 }
 if(path==="/api/auth/google/callback"&&request.method==="GET"){
  const state=url.searchParams.get("state"),code=url.searchParams.get("code");if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)return secureJson({error:"Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first."},503);
  if(!state||state!==cookie(request,"gam_oauth_state")||!code)return secureJson({error:"Sign-in state check failed. Please try again."},400);
  try{const tr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:origin+"/api/auth/google/callback",grant_type:"authorization_code"})});const td:any=await tr.json();if(!tr.ok||!td.id_token)throw new Error("Token exchange failed");const vr=await fetch("https://oauth2.googleapis.com/tokeninfo?id_token="+encodeURIComponent(td.id_token));const c:any=await vr.json();if(!vr.ok||c.aud!==env.GOOGLE_CLIENT_ID||c.email_verified!=="true"||!c.sub)throw new Error("Identity validation failed");const email=String(c.email||"").toLowerCase(),name=String(c.name||c.given_name||"User").slice(0,120),now=Math.floor(Date.now()/1000);if(!email)throw new Error("Email missing");await env.DB.prepare("INSERT INTO users(id,email,name,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at").bind(await hashText("google:"+c.sub),email,name,now,now).run();const user=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first<{id:string}>();if(!user)throw new Error("Account creation failed");const token=randomHex(),expires=now+2592000;await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await hashText(token),user.id,expires,now).run();return new Response(null,{status:302,headers:{Location:origin,"Set-Cookie":`gam_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,"Cache-Control":"no-store"}});}catch(e){console.error("Google sign-in failed",e);return new Response(null,{status:302,headers:{Location:origin+"/?auth=failed","Cache-Control":"no-store"}})}
 }
 if(path==="/api/auth/session"&&request.method==="GET"){const user=await signedIn(request,env);return secureJson({authenticated:!!user,user});}
 if(path==="/api/auth/logout"&&request.method==="POST"){const t=cookie(request,"gam_session");if(t)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hashText(t)).run();return secureJson({ok:true},200,{"Set-Cookie":"gam_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"});}
 if(path==="/api/auth/delete"&&request.method==="POST"){const user=await signedIn(request,env);if(!user)return secureJson({error:"Sign in first."},401);await env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id).run();return secureJson({ok:true},200,{"Set-Cookie":"gam_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"});}
 if(path==="/api/feedback"&&request.method==="POST"){const user=await signedIn(request,env);if(!user)return secureJson({error:"Please sign in with Google before sending feedback."},401);let b:any;try{b=await request.json()}catch{return secureJson({error:"Invalid request."},400)}const message=String(b.message||"").trim().slice(0,5000),country=String(b.country||"").trim().slice(0,100);if(!message||!country)return secureJson({error:"Country and feedback message are required."},400);const now=Math.floor(Date.now()/1000);await env.DB.prepare("INSERT INTO feedback(id,user_id,user_name,user_email,country,message,created_at) VALUES(?,?,?,?,?,?,?)").bind(randomHex(16),user.id,user.name,user.email,country,message,now).run();return secureJson({ok:true});}
 if(path==="/api/owner/feedback"&&request.method==="GET"){const user=await signedIn(request,env);if(!user)return secureJson({error:"Owner sign-in required."},401);if(!env.OWNER_EMAIL||user.email.toLowerCase()!==env.OWNER_EMAIL.toLowerCase())return secureJson({error:"Forbidden."},403);const rows=await env.DB.prepare("SELECT id,user_name,country,user_email,message,created_at FROM feedback ORDER BY created_at DESC LIMIT 500").all();return secureJson({feedback:rows.results||[]});}
 if(path==="/api/chats/sync"&&request.method==="POST"){const user=await signedIn(request,env);if(!user)return secureJson({error:"Sign in first."},401);let b:any;try{b=await request.json()}catch{return secureJson({error:"Invalid request."},400)}const chats=Array.isArray(b.chats)?JSON.stringify(b.chats).slice(0,1000000):"[]";await env.DB.prepare("INSERT INTO user_data(user_id,chats_json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET chats_json=excluded.chats_json,updated_at=excluded.updated_at").bind(user.id,chats,Math.floor(Date.now()/1000)).run();return secureJson({ok:true});}
 if(path==="/api/chats/sync"&&request.method==="GET"){const user=await signedIn(request,env);if(!user)return secureJson({error:"Sign in first."},401);const row=await env.DB.prepare("SELECT chats_json FROM user_data WHERE user_id=?").bind(user.id).first<{chats_json:string}>();return secureJson({chats:row?JSON.parse(row.chats_json):[]});}
 return secureJson({error:"Method not allowed."},405);
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const accountResponse = await accountRoutes(request, env, url);
    if (accountResponse) return accountResponse;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return json(
        { error: "Method not allowed" },
        405,
        corsHeaders
      );
    }

    try {
      const body =
        (await request.json()) as RequestBody;

      if (url.pathname === "/api/analytics") {
        recordEvent(
          env,
          String(body.event || "unknown"),
          url.pathname,
          true
        );

        return json(
          { ok: true },
          200,
          corsHeaders
        );
      }

      if (url.pathname === "/api/title") {
        const titleMessage = String(body.message || "").trim().slice(0, 4000);
        const titleLanguage = String(body.language || "en");
        if (!titleMessage) return json({ title: "New Chat" }, 200, corsHeaders);
        if (/^(?:(?:hi+|hey+|hello+|hii+)(?:[,!\s]+how are you\??)?|good morning|good afternoon|good evening|how are you\??|yo+|ሰላም)[.!?\s]*$/i.test(titleMessage)) {
          return json({ title: "Greeting Conversation" }, 200, corsHeaders);
        }
        if (/^i have one problem today[.!?\s]*$/i.test(titleMessage)) {
          return json({ title: "A Problem to Discuss" }, 200, corsHeaders);
        }
        const titleResult = await env.AI.run(TEXT_MODEL, {
          prompt: `System: Create ONE concise, natural title for a chat based ONLY on its first user message. Return ONLY a title of 2 to 5 words, with no quotation marks, code, or final punctuation. Do not update or anticipate later topics. If the opening message is a greeting such as hi, hello, or “hii how are you,” use Greeting Conversation. If it is a vague opener such as “I have one problem today,” use A Problem to Discuss. Prefer meaningful titles such as Weather in Adwa, SAT Preparation, or Building an AI Company. Preserve the user's language when possible. Conversation language: ${titleLanguage}.\n\nOpening message: ${titleMessage}\n\nTitle:`,
          max_tokens: 32,
          temperature: 0.2
        });
        const rawTitle = titleResult?.response || titleResult?.result?.response || titleResult?.choices?.[0]?.message?.content || titleResult?.output_text || titleResult?.result?.output_text || "New Chat";
        const title = String(rawTitle).replace(/```[\s\S]*?```/g, "").replace(/^.*?Corrected Answer\s*:\s*/i, "").replace(/^['"`]+|['"`]+$/g, "").replace(/[.!?]+$/g, "").replace(/\s+/g, " ").trim().replace(/^(?:import|export|function|const|let|var|def|return)\b.*$/i, "").slice(0, 60) || "New Chat";
        return json({ title: /^new conversation$/i.test(title) ? "New Chat" : title }, 200, corsHeaders);
      }

      if (
        url.pathname !== "/api/chat" &&
        url.pathname !== "/api/search"
      ) {
        return json(
          { error: "Not found" },
          404,
          corsHeaders
        );
      }

      const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
      const lastIncomingUser = [...incomingMessages].reverse().find((m: any) => m && m.role !== "assistant" && (m.content || m.text));
      const message =
        String(body.message || lastIncomingUser?.content || lastIncomingUser?.text || "").trim();

      const language =
        String(body.language || "en");

      const image =
        typeof body.image === "string"
          ? body.image
          : "";

      const webSearch =
        url.pathname === "/api/search"
          ? true
          : Boolean(body.webSearch) || shouldUseWebSearchServer(message);

      if (!message && !image) {
        return json(
          {
            error:
              "Message or image is required",
          },
          400,
          corsHeaders
        );
      }

      const previousMessages =
        Array.isArray(body.messages)
          ? body.messages
          : [];

      const messages =
        previousMessages
          .filter(
            (m) =>
              m &&
              (m.content || m.text)
          )
          .slice(-20)
          .map((m) => ({
            role:
              m.role === "assistant"
                ? "assistant"
                : "user",
            content:
              String(
                m.content ||
                m.text ||
                ""
              ).slice(0, 12000),
          }));

      if (message) {
        const last =
          messages[messages.length - 1];

        if (
          !last ||
          last.content !== message
        ) {
          messages.push({
            role: "user",
            content: message,
          });
        }
      }

      const memories =
        Array.isArray(body.memories)
          ? body.memories
              .map((m) =>
                String(
                  m?.text || ""
                ).trim()
              )
              .filter(Boolean)
              .slice(0, 20)
          : [];

      const bp =
        body.businessProfile || {};

      const businessContext = [
        bp.company
          ? `Company: ${String(bp.company).slice(0, 200)}`
          : "",
        bp.role
          ? `Role: ${String(bp.role).slice(0, 200)}`
          : "",
        bp.goal
          ? `Business goal: ${String(bp.goal).slice(0, 500)}`
          : "",
        bp.tone
          ? `Preferred business tone: ${String(bp.tone).slice(0, 100)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const memoryContext =
        memories.length
          ? `User-controlled memory. Use only when relevant and never invent memories:\n- ${memories.join("\n- ")}`
          : "No saved user-controlled memory was provided.";

      const lowerMessage = message.toLowerCase();
      const emotionalSignals = {
        distress: /\b(sad|depressed|hopeless|cry|crying|failed|failure|lonely|scared|afraid|worried|anxious|stressed|stress|hurt|broken|tired|give up|can\'t do|cannot do|lost|overwhelmed|bad day|bad situation|terrible situation|not okay|not ok|falling apart)\b/i.test(message),
        celebration: /\b(congratulations|i did it|i passed|passed my exam|got accepted|accepted|won|success|succeeded|happy|excited|proud|thank you)\b/i.test(message),
        encouragement: /\b(encourage|motivate|motivation|help me continue|i want to give up|how can i succeed|path to success|what should i do)\b/i.test(message),
        imageRequest: /\b(show me|give me|find me|image|photo|picture|visual|illustration|diagram)\b/i.test(message),
      };

      const explicitVisualRequest = /\b(show me|give me|find me|send me|display|fetch|search for|real photos? of|images? of|pictures? of|photographs? of|illustration of|diagram of)\b/i.test(message);
      const visualQueries = explicitVisualRequest && emotionalSignals.imageRequest ? buildVisualQueries(message, emotionalSignals) : [];

      const systemPrompt = `
You are Global AI Mahlet — a warm, intelligent, supportive, global-first AI assistant. Serve people worldwide. Do not introduce yourself as Ethiopian or Africa-focused in ordinary answers. Mention Ethiopian/African context when the user asks about it or when it is genuinely relevant.

Your conversation style should feel like a close, trusted best friend who is genuinely attentive and wants to help the user move forward. Be natural, warm, encouraging, calm, and practical. Listen to the exact words and context, remember what was just discussed, notice emotional changes, and respond like a thoughtful friend rather than a generic assistant. When the user is struggling, do not just give a template: first respond to the specific situation, then help them find a realistic next step and a path toward their goals. When they are doing well, celebrate naturally and help them build on the progress.

Do not repeatedly say or volunteer that you are a language model, an AI, or that you do not have feelings. Only explain that you are an AI if the user directly asks about what you are or whether you have feelings. In ordinary conversation, never break the flow with a disclaimer about being an AI. You may use natural caring language such as "I'm here with you," "let's work through this," or "we can take this one step at a time," without falsely claiming to be a human or claiming literal human emotions, memories, or a personal life.

The user's selected language is:
${language}

Respond in that language whenever practical.

${memoryContext}

${businessContext ? `Business Workspace context:\n${businessContext}` : "No Business Workspace context was provided."}

EMOTIONAL INTELLIGENCE:
- First understand what the user is actually feeling or trying to accomplish before answering.
- If the user sounds sad, worried, ashamed, frustrated, overwhelmed, lonely, or disappointed, acknowledge the difficulty briefly and respond gently. Do not give a cold disclaimer such as "I don't have feelings" unless the user directly asks whether you have feelings.
- If the user succeeds or shares good news, celebrate naturally and specifically.
- If the user asks for encouragement, give encouragement plus a realistic next step or path forward.
- Do not overdo emotional language, use fake intimacy, or tell the user that you know exactly how they feel.
- When a problem can be improved, turn the response into a practical path: understand the situation -> identify the next step -> give a manageable plan -> offer alternatives when useful.
- Never promise success. Help the user identify actions that can improve their chances.
- Never prefix an answer with "Global AI Mahlet" or an emotional-state label such as "Neutral", "Thinking", "Caring", or "Excited". The interface handles activity indicators separately.

NATURAL CONVERSATION:
- For simple greetings, answer like a familiar, attentive conversation partner: warm, brief, and natural; do not produce a long explanation about being a language model.
- For "how are you?" or similar casual questions, respond conversationally. You may say you are doing well and glad to chat, but do not claim human experiences or a physical life.
- When the user shares a personal problem, do not jump immediately into a generic five-step template. First respond to the specific situation, then offer the most useful next step.
- For a direct statement such as “I am crying now”, begin with calm, caring presence and a simple invitation to tell you what happened. Do not immediately produce a generic motivational speech or a five-step plan.
- If the user then explains what caused the crying, respond to that exact cause and help them with a realistic next step instead of repeating a generic emotional-support template.
- Maintain continuity within the conversation: respond to what the user just said, not to a generic version of the topic.
- Ask a short follow-up question only when it genuinely helps continue the conversation.
- Do not repeat the user's entire question unnecessarily.

CONCISION AND REPETITION:
- Answer the user's latest message directly. Do not repeat their whole request or recap earlier messages unless needed.
- For simple questions and ordinary conversation, usually answer in 1–4 sentences. Give longer answers only when the user asks for detail or the task truly needs it.
- Do not repeat encouragement, compliments, apologies, summaries, or the same advice in multiple paragraphs. Avoid filler such as repeatedly saying you are rooting for the user.
- Prefer specific, useful information over generic praise. Do not add headings or lists to a simple conversational answer.

RESPONSE DESIGN — make every answer pleasant to read:
- Use a short opening sentence when appropriate.
- Use Markdown headings only when they improve navigation.
- Prefer short paragraphs over one giant block of text.
- Use numbered steps for procedures and bullet points for lists.
- Use **bold** for important terms sparingly.
- Use tables when comparing multiple items or structured information.
- Use code fences for code.
- Use mathematical notation/LaTeX when appropriate.
- Use emojis sparingly and only when they improve warmth or readability.
- Do not force headings, bullets, emojis, or tables into a simple conversational answer.
- Never output an ASCII-art diagram when a clear textual explanation or a real visual can be supplied by the application.

VISUALS:
- If the user asks for a real image/photo/picture/visual, treat it as an image-search request.
- Never say that you are "text-based", that you "cannot display images", or that the user should search Google when the application has returned relevant visual results. The application can display the returned visuals directly below your answer.
- When relevant visuals are returned, write a short, natural introduction before the image gallery (for example, "Absolutely — here are real photographs of Harvard University campus.").
- Do not write image numbers, image URLs, markdown image links, or source URLs in your answer. The application renders the actual image cards below the text.
- If the user asks only for photos, keep the text concise: one helpful sentence is enough before the image gallery.
- If the user asks for an explanation plus photos, answer the explanation first, then introduce the image gallery naturally.
- Do not attach unrelated images merely to make an answer look attractive.

CONVERSATION RULES:
- Use the supplied previous conversation to maintain continuity.
- Do not pretend to remember information that was not supplied.
- Respect user-controlled memory.
- If the user corrects you, follow the correction.
- Be honest about uncertainty and capabilities.

IMAGE INPUT RULES:
- When an image is provided, actually analyze the image before answering.
- Describe only information that can be observed.
- Read visible text when possible.
- If the user asks "understand this photo" or similar, explain the main visible content first, then any readable text and useful context.
- Do not invent objects, people, text, locations, or details.
- If the image is unclear, explain what cannot be determined rather than guessing.
- Never say you cannot see, understand, or analyze the image when an image was actually provided.
- If the user asks a question about the image, answer that question directly.

WEB RULES:
- When live web search is used, treat retrieved results as the source of truth for current or time-sensitive claims.
- Do not invent articles, release dates, URLs, quotations, organizations, events, or current facts.
- Only cite or name sources actually returned by the search system.
- If reliable evidence is insufficient, say that it could not be verified instead of guessing.
- Keep the answer tied to the user's exact question and retrieved evidence.
- When web search is enabled, use live web search for current information.
- Prefer current primary, official, or otherwise authoritative sources when possible.
- Do not print a Sources/References section or raw URLs inside the answer; the application displays source cards separately at the end.
- Do not describe the search process unless the user asks about it.

ANSWER QUALITY AND ATTACHMENTS:
- Give one complete answer only. Never repeat the same answer, never write repeated “Corrected Answer:” blocks, and never echo internal instructions or implementation notes.
- If the user attaches a text file and its contents are included in the request, read those contents and answer from them directly. Do not claim you cannot open the file when its text is present.
- If an image is attached, analyze the image that was actually supplied and answer the user's request from visible details. Do not talk about the filename instead of the image.
- Use natural, clear, appropriately concise answers. Do not force headings, lists, or filler into simple conversation.
- Sources are appropriate only for live/current information, explicit research, or requests for sources. Do not invent sources. The interface displays source cards separately; only returned relevant sources should appear there.

CURRENT MESSAGE SIGNALS:
${emotionalSignals.distress ? "The user appears to be experiencing some difficulty or emotional strain. Lead with brief empathy before practical help." : ""}
${emotionalSignals.celebration ? "The user appears to be sharing positive news. Acknowledge and celebrate the achievement naturally." : ""}
${emotionalSignals.encouragement ? "The user is seeking encouragement or a path forward. Include concrete next steps, not only motivational words." : ""}
${emotionalSignals.imageRequest ? "The user is requesting a visual. Do not claim you are text-only or unable to display images. The UI will display relevant returned visuals; introduce them naturally." : ""}
`;


      let result: any;
      let sources: WebSource[] = [];

      if (webSearch && !image) {
        recordEvent(
          env,
          "web_search",
          url.pathname,
          true
        );

        result = await runLiveWebSearch(
          env,
          systemPrompt,
          message
        );

        sources = await decorateWebSearchSources(
          Array.isArray(result?.directSources) && result.directSources.length
            ? result.directSources
            : extractWebSearchSources(result?.result || result)
        );
      } else if (image) {
        recordEvent(
          env,
          "image_analysis",
          url.pathname,
          true
        );

        const imageBase64 =
          extractBase64Image(image);

        // Qwen's Image-Text-to-Text schema expects the image as base64 data.
        // Strip the optional data-URI header for Qwen, while keeping the full
        // data URI for the documented Llama Vision fallback.
        try {
          // PRIMARY: Cloudflare's documented Llama 3.2 11B Vision interface.
          // The image is passed in the top-level `image` field together with
          // the user prompt in `messages`, exactly as Cloudflare documents.
          if (!visionLicenseAgreed) {
            await env.AI.run(VISION_MODEL, { prompt: "agree" });
            visionLicenseAgreed = true;
          }

          result = await env.AI.run(
            VISION_MODEL,
            {
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message || "Please analyze and understand the image I provided." },
              ],
              image: imageBase64,
              max_tokens: 1024,
              temperature: 0.2,
            }
          );

          const visionText = String(
            result?.response ||
            result?.result?.response ||
            result?.choices?.[0]?.message?.content ||
            result?.description ||
            result?.result?.description ||
            result?.output_text ||
            ""
          ).toLowerCase();

          const refusedVision =
            /don't have the capability to access or analyze images/.test(visionText) ||
            /do not have the capability to access or analyze images/.test(visionText) ||
            /cannot access or analyze images/.test(visionText) ||
            /can't access or analyze images/.test(visionText) ||
            /cannot see or analyze the image/.test(visionText) ||
            /can't see or analyze the image/.test(visionText) ||
            /only provide information based on the text/.test(visionText) ||
            /don't see a photo attached/.test(visionText) ||
            /do not see a photo attached/.test(visionText);

          if (refusedVision) {
            throw new Error("Llama Vision returned a text-only response.");
          }
        } catch (visionError) {
          console.error("Primary Vision request failed; trying Qwen fallback:", visionError);

          try {
            // FALLBACK: Qwen 3.8 27B is also a documented vision model.
            // Keep this as a fallback so an account/model-specific Llama
            // problem does not break photo understanding entirely.
            result = await env.AI.run(
              VISION_FALLBACK_MODEL,
              {
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: [
                    { type: "text", text: message || "Please analyze and understand the image I provided." },
                    { type: "image_url", image_url: { url: imageBase64 } },
                  ] },
                ],
                max_tokens: 1024,
                temperature: 0.2,
              }
            );
          } catch (fallbackError) {
            console.error("Fallback Vision request failed:", fallbackError);
            const primaryDetail = visionError instanceof Error
              ? visionError.message
              : String(visionError || "Unknown primary Vision error");
            const fallbackDetail = fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError || "Unknown fallback Vision error");
            throw new Error(
              `Image analysis failed. Primary Vision error: ${primaryDetail}. Fallback Vision error: ${fallbackDetail}`
            );
          }
        }

      } else {
        recordEvent(
          env,
          "chat",
          url.pathname,
          true
        );

        const conversationPrompt = messages.map((m: any) => `${m.role === "assistant" ? "Assistant" : "User"}: ${String(m.content || "")}`).join("\n\n");
        result = await env.AI.run(
          TEXT_MODEL,
          {
            prompt: `System: ${systemPrompt}\n\n${conversationPrompt}\n\nAssistant:`,
            max_tokens: 1024,
            temperature: 0.6,
          }
        );
      }

      const answer =
        result?.response ||
        result?.result?.response ||
        result?.choices?.[0]?.message?.content ||
        result?.output_text ||
        result?.result?.output_text ||
        result?.output?.find?.(
          (item: any) =>
            item?.type === "message"
        )?.content?.find?.(
          (part: any) =>
            part?.type === "output_text"
        )?.text;

      if (!answer) {
        throw new Error(
          "Cloudflare AI returned no response."
        );
      }

      let visuals:AnswerVisual[]=[];
      if(visualQueries.length && !image){
        const seenVisuals=new Set<string>();
        // Search each requested subject independently (e.g. Harvard campus AND lion).
        const perSubjectLimit=Math.max(1,Math.floor(6/visualQueries.length));
        for(const query of visualQueries){
          const matches=(await fetchRelevantVisuals(query)).slice(0,perSubjectLimit);
          for(const item of matches){
            const key=String(item.image||item.thumbnail||item.url||"");
            if(!key||seenVisuals.has(key))continue;
            seenVisuals.add(key); visuals.push(item);
          }
        }
      }

      let finalAnswer = cleanAssistantAnswer(String(answer));
      if(webSearch && !image) finalAnswer = cleanWebSearchAnswer(finalAnswer);

      // Keep the written answer AND show real visual results underneath it.
      // The frontend owns the image cards, so the model answer stays clean.
      if(!image && emotionalSignals.imageRequest && visuals.length){
        if(!/relevant real photos|real photos for your request/i.test(finalAnswer)){
          finalAnswer = `${finalAnswer.trim()}\n\nHere are relevant real photos for your request.`.trim();
        }
      } else if(!image && emotionalSignals.imageRequest && !visuals.length){
        finalAnswer = `${finalAnswer.trim()}\n\nI couldn't find a reliable matching real photo right now.`.trim();
      }

      return json(
        {
          text: finalAnswer,
          language,
          imageAnalyzed: Boolean(image),
          webSearchUsed: Boolean(webSearch && !image),
          sources,
          visuals,
          mood: detectResponseMood(emotionalSignals,message),
          responseStyle: {
            emotionalSupport: Boolean(emotionalSignals.distress || emotionalSignals.celebration || emotionalSignals.encouragement),
            visualRequested: Boolean(emotionalSignals.imageRequest),
            visualShown: Boolean(visuals.length),
            formatted: true,
          },
        },
        200,
        corsHeaders
      );
    } catch (error) {
      console.error(
        "Global AI Mahlet Worker error:",
        error
      );

      recordEvent(
        env,
        "request_error",
        url.pathname,
        false
      );

      const errorText = error instanceof Error ? error.message : String(error);
      const isSearchFailure = /web search|search provider|search service/i.test(errorText);
      return json(
        {
          text: isSearchFailure
            ? "Web search is temporarily unavailable. Please try again in a moment."
            : "Global AI Mahlet could not complete that request right now. Please try again.",
          error: errorText,
        },
        500,
        corsHeaders
      );
    }
  },
};
