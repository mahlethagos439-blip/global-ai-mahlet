interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  ANALYTICS?: AnalyticsEngineDataset;
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

function isClearlyBadSituation(text:string):boolean{
  const q=String(text||"").trim().toLowerCase();
  if(!q)return false;
  return /\b(i am|i\'m|im|i feel|i\'ve been|i have been)\b[^\n]{0,80}\b(bad situation|terrible situation|very bad situation|in a bad situation|crying|cry|hopeless|overwhelmed|falling apart|give up|cannot go on|can\'t go on)\b/i.test(q)
    || /\b(i am|i\'m|im)\s+(sad|scared|afraid|worried|stressed|hurt|lonely|overwhelmed|not okay|not ok)\b/i.test(q);
}

function shouldUseWebSearchServer(text:string):boolean{
  const q=String(text||"").trim().toLowerCase();
  if(!q)return false;
  if(/^(hi|hii|hello|hey|good morning|good afternoon|good evening|thanks|thank you|ok|okay|yes|no|sure|great|nice|bye|goodbye)[.!?\s]*$/i.test(q))return false;
  if(/\b(search|look up|search the web|search online|search the internet|web search|browse the web|research online|find online|find me|search me|internet|online search)\b/.test(q))return true;
  if(/\b(find|give|show|send|get|provide)\s+(me\s+)?(the\s+)?(official\s+)?(website|link|source|sources|article|articles|photos|images|pictures)\b/.test(q))return true;
  if(/\bofficial\s+(website|page|site|source)\b/.test(q))return true;
  if(/\b(latest|current|right now|as of|today|tonight|yesterday|this week|this month|recent|recently|breaking|live)\b/.test(q))return true;
  if(/\b(weather|forecast|temperature|news|score|scores|match|game|schedule|price|prices|exchange rate|traffic|outage|power outage|stock|stocks|market|election|results|event|events|opening hours|hours|release|released|version|update|updates|availability)\b/.test(q))return true;
  // A clearly distressed message must never trigger external search just because
  // it is long enough. This keeps the Sources UI hidden for supportive conversations.
  if(isClearlyBadSituation(q))return false;
  return q.length >= 12;
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

function cleanVisualText(value:any):string{
  return String(value?.value??value??"").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
}

function isPhysicalPlaceVisual(query:string, title:string, description:string):boolean{
  const q=query.toLowerCase();
  const titleText=String(title||"").toLowerCase();
  const descriptionText=String(description||"").toLowerCase();
  const searchable=(titleText+" "+descriptionText);
  const badHit=/\b(statue|sculpture|portrait|painting|artwork|costume|gown|robe|medal|bust|museum object|artifact|book cover|logo|seal|flag|shirt|merchandise|football player|basketball player|map|maps|diagram|floor plan|site plan|location map)\b/i.test(searchable);
  if(badHit)return false;

  // For a named place, the place name must actually appear in the image
  // title/metadata. Do not accept an unrelated photograph merely because
  // the description happens to contain one matching word.
  const namedPlace =
    /\b(harvard|mit|stanford|yale|princeton|columbia|duke|cornell|berkeley|oxford|cambridge)\b/i.exec(q)?.[1]?.toLowerCase() || "";
  if(namedPlace && !titleText.includes(namedPlace)){
    // Allow a well-known landmark explicitly requested with the institution.
    if(namedPlace==="harvard" && !/\b(harvard yard|widener|harvard hall)\b/i.test(titleText))return false;
    if(namedPlace==="mit" && !/\b(mit|massachusetts institute|great dome|killian)\b/i.test(titleText))return false;
    if(!/\b(campus|yard|hall|library|quad|courtyard|gate|tower|entrance|exterior|grounds|facade|front|school|university|college)\b/i.test(titleText))return false;
  }

  const requestedLandmark = q.match(/\b(harvard yard|widener library|great dome|killian court)\b/i)?.[1]?.toLowerCase() || "";
  if(requestedLandmark && !titleText.includes(requestedLandmark) &&
     !(requestedLandmark==="widener library" && /\bwidener\b/i.test(titleText))) return false;

  const physicalHit=/\b(campus|yard|building|hall|library|quad|courtyard|gate|tower|entrance|exterior|street|view|aerial|grounds|facade|front|school|university|college)\b/i.test(searchable);
  return physicalHit;
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
    const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !/^(photo|photograph|picture|image|visual|real|actual|campus|building|university|college|school|the|of|in|and|yard|city|massachusetts|north|carolina|texas)$/i.test(t));
    const ranked=pages.map((item,index)=>{
      const title=String(item?.title||"").replace(/^File:/i,"");
      const meta=item?.imageinfo?.[0]?.extmetadata||{};
      const description=cleanVisualText(meta?.ImageDescription);
      const searchable=(title+" "+description).toLowerCase();
      const entityMatches=terms.reduce((n,t)=>n+(searchable.includes(t)?1:0),0);
      const titleMatches=terms.reduce((n,t)=>n+(title.toLowerCase().includes(t)?1:0),0);
      const exactPhrase=/harvard\s+university/i.test(query)&&/harvard\s+university/i.test(searchable)?8:0;
      const physical=/\b(campus|yard|hall|library|quad|courtyard|gate|tower|entrance|exterior|street|view|aerial|grounds|facade|front|school|university|college)\b/i.test(searchable)?4:0;
      const bad=/\b(statue|sculpture|portrait|painting|artwork|costume|gown|robe|medal|bust|artifact|book cover|logo|seal|flag|shirt|merchandise|player|map|maps|diagram|floor plan|site plan|campus map|location map)\b/i.test(searchable)?-30:0;
      const placeValid=!isPlaceQuery || isPhysicalPlaceVisual(query,title,description);
      return {item,index,score:titleMatches*12+entityMatches*3+exactPhrase+physical+bad,placeValid};
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
    const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=3 && !/^(photo|photograph|picture|image|visual|real|actual|campus|building|university|college|school|the|of|in|and|yard|city|massachusetts|north|carolina|texas)$/i.test(t));
    const namedPlace=/\b(harvard|mit|stanford|yale|princeton|columbia|duke|cornell|berkeley|oxford|cambridge)\b/i.exec(query)?.[1]?.toLowerCase()||"";
    const ranked=results.map((item:any,index:number)=>{
      const title=typeof item?.title==="string"?item.title:"";
      const tags=Array.isArray(item?.tags)?item.tags.map((tag:any)=>typeof tag==="string"?tag:String(tag?.name||"")).join(" "):"";
      const desc=typeof item?.description==="string"?item.description:"";
      const searchable=(title+" "+tags+" "+desc).toLowerCase();
      const entityMatches=terms.reduce((n,t)=>n+(searchable.includes(t)?1:0),0);
      const titleMatches=terms.reduce((n,t)=>n+(title.toLowerCase().includes(t)?1:0),0);
      const physical=/\b(campus|yard|hall|library|quad|courtyard|gate|tower|entrance|exterior|street|view|aerial|grounds|facade|front|school|university|college)\b/i.test(searchable)?4:0;
      const bad=/\b(statue|sculpture|portrait|painting|artwork|costume|gown|robe|medal|bust|artifact|book cover|logo|seal|flag|shirt|merchandise|player|map|maps|diagram|floor plan|site plan|campus map|location map)\b/i.test(searchable)?-30:0;
      const namedPlaceHit=!namedPlace || title.toLowerCase().includes(namedPlace) || (namedPlace==="harvard" && /\b(widener|harvard yard|harvard university)\b/i.test(title));
      return {item,index,score:titleMatches*12+entityMatches*3+physical+bad,valid:!isPlaceQuery || (namedPlaceHit && entityMatches>0 && physical>0 && bad===0)};
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
        "Harvard Yard Harvard University",
        "Widener Library Harvard University",
        "Harvard University Yard campus",
        "Harvard University campus exterior Massachusetts"
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
    for(const item of wiki){
      const key=item.image||item.thumbnail||item.url||"";
      if(!key||seen.has(key))continue;
      seen.add(key);
      collected.push(item);
    }
  }
  for(const q of variants){
    const openverse=await fetchOpenverseVisuals(q);
    for(const item of openverse){
      const key=item.image||item.thumbnail||item.url||"";
      if(!key||seen.has(key))continue;
      seen.add(key);
      collected.push(item);
    }
  }
  // Re-check the identity at the final boundary. It is better to show fewer
  // trustworthy photos than to fill the gallery with unrelated images.
  if(/\bharvard\b/i.test(base)){
    return collected
      .filter(item=>/\bharvard\b|\bwidener\b|\bharvard yard\b/i.test(String(item.title||"")))
      .slice(0,4);
  }
  return collected.slice(0,4);
}

function buildVisualSources(visuals:AnswerVisual[]):WebSource[]{
  const out:WebSource[]=[];
  const seen=new Set<string>();
  for(const visual of visuals||[]){
    const url=String(visual?.url||"").trim();
    if(!url)continue;
    const provider=String(visual?.provider||"").trim();
    const key=(provider||url).toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    let icon="";
    if(/wikimedia/i.test(provider)) icon="https://commons.wikimedia.org/static/favicon/commons.ico";
    else if(/openverse/i.test(provider)) icon="https://openverse.org/favicon.ico";
    else {
      try{
        const host=new URL(url).hostname;
        icon="https://www.google.com/s2/favicons?domain="+encodeURIComponent(host)+"&sz=128";
      }catch{}
    }
    out.push({
      title:provider||"Image source",
      url,
      ...(icon?{image:icon,imageKind:"favicon" as const}:{}),
    });
  }
  return out.slice(0,8);
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
  text=text.replace(/\n{3,}/g,"\n\n").trim();

  // If cleanup removed an image-only answer, keep a neutral fallback.
  // Do not force the same canned opening on every visual response.
  if(!text || text.length<12 || /^here are (some )?(relevant|real) (photos?|images?|pictures?)[.!]?$/i.test(text)){
    return "";
  }
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
      messages:[
        {role:"system",content:prompt},
        {role:"user",content:message}
      ],
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
        const titleMessage=String(body.message||"").trim().slice(0,4000);
        const titleLanguage=String(body.language||"en");
        if(!titleMessage){
          return json({title:"New conversation"},200,corsHeaders);
        }
        const titleResult=await env.AI.run(
          TEXT_MODEL,
          {
            messages:[
              {
                role:"system",
                content:
                  `Create a short title for this conversation. Return ONLY the title, with no quotation marks, no punctuation at the end, and no explanation. Use 2 to 6 words. The title should describe the user's intent, not copy their exact sentence. If the user only greets you (for example hi, hello, hey, hii), return exactly: Greeting. For all other messages, summarize the user's intent naturally in 2 to 6 words. The user's language is ${titleLanguage}.`
              },
              {role:"user",content:titleMessage}
            ],
            max_tokens:32,
            temperature:0.2
          }
        );
        const rawTitle=
          titleResult?.response||
          titleResult?.result?.response||
          titleResult?.choices?.[0]?.message?.content||
          titleResult?.output_text||
          titleResult?.result?.output_text||
          "New conversation";
        const title=String(rawTitle).replace(/^['"`]+|['"`]+$/g,"").replace(/[.!?]+$/g,"").replace(/\s+/g," ").trim().slice(0,80)||"New conversation";
        return json({title},200,corsHeaders);
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

      const message =
        String(body.message || "").trim();

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
        distress: isClearlyBadSituation(message) || /\b(sad|depressed|hopeless|cry|crying|failed|failure|lonely|scared|afraid|worried|anxious|stressed|stress|hurt|broken|tired|give up|can\'t do|cannot do|lost|overwhelmed|bad day|bad situation|terrible situation|not okay|not ok|falling apart)\b/i.test(message),
        celebration: /\b(congratulations|i did it|i passed|passed my exam|got accepted|accepted|won|success|succeeded|happy|excited|proud|thank you)\b/i.test(message),
        encouragement: /\b(encourage|motivate|motivation|help me continue|i want to give up|how can i succeed|path to success|what should i do)\b/i.test(message),
        imageRequest: /\b(show me|give me|find me|image|photo|picture|visual|illustration|diagram)\b/i.test(message),
      };

      const visualQuery=buildVisualQuery(message,emotionalSignals);

      const systemPrompt = `
You are Global AI Mahlet — a warm, intelligent, supportive AI assistant.

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

RESPONSE DESIGN — make every answer pleasant to read:
- Adapt the response style to the request, context, and conversation. Do not make every answer sound the same.
- Avoid repetitive openings such as "Absolutely", "Sure", "Of course", "Certainly", or "Here are". Use them only occasionally and only when they genuinely fit.
- Vary sentence structure and pacing naturally. Some answers should be one or two sentences; others can use headings, bullets, examples, tables, or step-by-step guidance when useful.
- For image requests, prioritize the actual requested visual over filler text. For educational topics, use clear explanations and only visuals that genuinely teach or illustrate the topic.
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
- Make the opening and wording vary naturally from answer to answer. Do NOT repeatedly begin with "Absolutely", "Sure", "Of course", "Here are", or any other fixed canned phrase.
- Match the wording to the user's exact request and the situation. For a direct photo request, you can use a simple line such as "Real photographs of Harvard's campus are below." For an explanation plus visuals, explain first and then introduce the visuals naturally. For casual conversation, you may not need any introduction at all.
- Never use a fixed template just because visuals are present. The response should feel like it was written specifically for this user and this question.
- Do not write image numbers, image URLs, markdown image links, or source URLs in your answer. The application renders the actual image cards below the text.
- If the user asks only for photos, keep the text concise: one natural sentence or no extra sentence when the images speak for themselves.
- If the user asks for an explanation plus photos, answer the explanation first, then introduce the image gallery naturally.
- Do not attach unrelated images merely to make an answer look attractive.
- Do not mention or use an uploaded user image as a web source. User-uploaded images are input for analysis only.
- Never write source URLs or a source list in the answer; the application creates the compact Sources UI from actual retrieved sources.
- When visuals are shown, prefer a clean, stylish structure: concise answer -> useful visual gallery -> brief context when needed. Do not fill the response with repeated filler.

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
        const qwenImageBase64 = imageBase64.replace(
          /^data:image\/[^;]+;base64,/i,
          ""
        );

        // Keep the multimodal request small and explicit.  In particular,
        // do not send the entire 20-message text history together with a
        // large phone photo.  The Vision model only needs the system rules,
        // the recent conversation context, and the user's current question.
        const recentImageMessages = messages
          .slice(-6)
          .map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || "").slice(0, 4000),
          }));

        // Use the Vision model's prompt + image form for the multimodal call.
        // This avoids sending a large/irregular chat-message array alongside
        // the photo while still preserving the user's current question and
        // a small amount of recent context. Cloudflare documents both image
        // input and the prompt field for this model.
        const recentContext = messages
          .slice(-4)
          .map((m) => `${m.role}: ${String(m.content || "").slice(0, 2000)}`)
          .join("\n");

        const visionPrompt = [
          systemPrompt,
          recentContext ? `Recent conversation context:\n${recentContext}` : "",
          `Current user request:\n${message || "Please analyze and understand the image I provided."}`,
          "Analyze the supplied image and answer the current user request directly. Do not claim that you cannot see or analyze the image."
        ].filter(Boolean).join("\n\n");

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
                {
                  role: "system",
                  content: systemPrompt,
                },
                {
                  role: "user",
                  content: message || "Please analyze and understand the image I provided.",
                },
              ],
              image: imageBase64,
              max_tokens: 1024,
              temperature: 0.4,
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
                  {
                    role: "system",
                    content: systemPrompt,
                  },
                  {
                    role: "user",
                    content: message || "Please analyze and understand the image I provided.",
                  },
                ],
                image: imageBase64,
                max_tokens: 1024,
                temperature: 0.4,
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

        result = await env.AI.run(
          TEXT_MODEL,
          {
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              ...messages,
            ],
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

      const visuals=visualQuery && !image
        ? await fetchRelevantVisuals(visualQuery)
        : [];

      // Sources are evidence of external retrieval, not a decoration.
      // Uploaded user images are NEVER sources. Visuals found online ARE sources.
      let externalSources:WebSource[]=[];
      if(!image && !emotionalSignals.distress){
        if(webSearch) externalSources.push(...sources);
        if(visuals.length) externalSources.push(...buildVisualSources(visuals));
      }
      const sourceSeen=new Set<string>();
      externalSources=externalSources.filter(source=>{
        const key=String(source.url||"").trim();
        if(!key||sourceSeen.has(key))return false;
        sourceSeen.add(key);
        return true;
      }).slice(0,8);

      let finalAnswer = cleanAssistantAnswer(String(answer));
      if(webSearch && !image) finalAnswer = cleanWebSearchAnswer(finalAnswer);

      // Keep the written answer AND show real visual results underneath it.
      // The frontend owns the image cards, so the model answer stays clean.
      // Add only a natural, varied visual cue when the model did not already
      // introduce the gallery. Never force the same "Absolutely..." sentence.
      if(!image && emotionalSignals.imageRequest && visuals.length){
        const clean=finalAnswer.trim();
        if(!clean){
          finalAnswer = "Real images matching your request are below.";
        } else if(!/(photo|photos|image|images|picture|pictures|visual|below|shown|gallery)/i.test(clean)){
          finalAnswer = `${clean}\n\nThe matching images are shown below.`.trim();
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
          sources: externalSources,
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
      return json(
        {
          text: errorText.includes("web search") || errorText.includes("Web search")
            ? errorText
            : "Global AI Mahlet could not complete that request right now.",
          error: errorText,
        },
        500,
        corsHeaders
      );
    }
  },
};
