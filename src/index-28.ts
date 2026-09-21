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
const SEARCH_MODEL = "openai/gpt-4o-mini";

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
  const match = value.match(/^data:image\/[^;]+;base64,(.+)$/s);
  return match ? match[1] : value;
}

type WebSource={title?:string;url?:string;image?:string;imageKind?:"og"|"favicon"};
type AnswerVisual={image?:string;thumbnail?:string;title?:string;url?:string;creator?:string;license?:string;licenseUrl?:string;provider?:string};

function buildVisualQuery(message:string, signals:{distress:boolean;celebration:boolean;encouragement:boolean;imageRequest:boolean}):string{
  const text=String(message||"").trim();
  if(signals.imageRequest){
    return text.replace(/\b(show|give|find|send)\s+(me\s+)?(a|an|the)?\s*(real\s+)?(image|photo|picture|visual|illustration|diagram)\s*(of|about)?\s*/i,"").trim().slice(0,180) || text.slice(0,180);
  }
  if(signals.distress)return "supportive conversation comfort friend encouragement";
  if(signals.celebration)return "celebration achievement success happy student";
  if(signals.encouragement)return "motivation studying student goal achievement";
  if(/\b(solar system|planet|planets|space|galaxy|star|moon|sun)\b/i.test(text))return text+" educational";
  if(/\b(photosynthesis|cell|biology|anatomy|human body|chemistry|chemical|physics|electricity|magnet|gravity|atom|molecule|math|geometry|triangle|algebra)\b/i.test(text))return text+" educational diagram";
  if(/\b(animal|bird|flower|plant|tree|ocean|mountain|river|forest|nature|country|city|landmark|museum)\b/i.test(text))return text+" photo";
  if(/\b(code|coding|programming|software|computer|robot|artificial intelligence|AI)\b/i.test(text))return text+" technology";
  return "";
}

async function fetchOpenverseVisuals(query:string):Promise<AnswerVisual[]>{
  if(!query)return [];
  try{
    const endpoint=new URL("https://api.openverse.org/v1/images/");
    endpoint.searchParams.set("q",query.slice(0,180));
    endpoint.searchParams.set("page_size","8");
    const response=await fetch(endpoint.href,{
      method:"GET",
      redirect:"follow",
      headers:{"Accept":"application/json","User-Agent":"GlobalAIMahlet/1.0"}
    });
    if(!response.ok)return [];
    const data:any=await response.json();
    const results=Array.isArray(data?.results)?data.results:[];
    const seen=new Set<string>();
    const visuals:AnswerVisual[]=[];
    for(const item of results){
      const image=typeof item?.url==="string"?item.url:"";
      const thumbnail=typeof item?.thumbnail==="string"?item.thumbnail:"";
      if(!image&&!thumbnail)continue;
      const key=image||thumbnail;
      if(seen.has(key))continue;
      seen.add(key);
      visuals.push({
        image,
        thumbnail,
        title:typeof item?.title==="string"&&item.title?item.title:"Related visual",
        url:typeof item?.foreign_landing_url==="string"?item.foreign_landing_url:"",
        creator:typeof item?.creator==="string"?item.creator:"",
        license:typeof item?.license==="string"?item.license:"",
        licenseUrl:typeof item?.license_url==="string"?item.license_url:"",
        provider:typeof item?.provider==="string"?item.provider:"Openverse"
      });
      if(visuals.length>=3)break;
    }
    return visuals;
  }catch(error){
    console.warn("Openverse visual search failed:",error);
    return [];
  }
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
  const input =
    systemPrompt +
    "\n\nLIVE WEB SEARCH IS REQUIRED FOR THIS REQUEST. Search first, then answer only from information actually retrieved by the web-search tool. Do not invent a source, date, URL, quote, organization, event, or current fact. If reliable evidence is not returned, explicitly say it could not be verified. Do not print a Sources/References section, [Source N] labels, raw URLs, or markdown source links; the application will display the retrieved sources separately at the end of the answer. Answer naturally and directly in a clean ChatGPT-style format.\n\nUSER REQUEST:\n" +
    message;

  const request = {
    input,
    max_output_tokens: 2000,
    tools: [{ type: "web_search_preview" }],
  };

  try{
    return {
      result:await env.AI.run(
        SEARCH_MODEL,
        request,
        { gateway: { id: "default" } }
      ),
      directSources:[] as WebSource[]
    };
  }catch(primaryError){
    console.error("Primary live web search failed:", primaryError);
    try{
      return {
        result:await env.AI.run(
          "openai/gpt-4.1-mini",
          request,
          { gateway: { id: "default", skipCache: true } }
        ),
        directSources:[] as WebSource[]
      };
    }catch(fallbackError){
      console.error("AI Gateway web search failed; trying direct search fallback:", fallbackError);
      const direct=await runDirectWebSearchWithAI(env,systemPrompt,message);
      return {
        result:direct.result,
        directSources:direct.sources
      };
    }
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
        Boolean(body.webSearch) ||
        url.pathname === "/api/search";

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
        distress: /\b(sad|depressed|hopeless|cry|crying|failed|failure|lonely|scared|afraid|worried|anxious|stressed|stress|hurt|broken|tired|give up|can't do|cannot do|lost|overwhelmed|bad day)\b/i.test(message),
        celebration: /\b(congratulations|i did it|i passed|passed my exam|got accepted|accepted|won|success|succeeded|happy|excited|proud|thank you)\b/i.test(message),
        encouragement: /\b(encourage|motivate|motivation|help me continue|i want to give up|how can i succeed|path to success|what should i do)\b/i.test(message),
        imageRequest: /\b(show me|give me|find me|image|photo|picture|visual|illustration|diagram)\b/i.test(message),
      };

      const visualQuery=buildVisualQuery(message,emotionalSignals);

      const systemPrompt = `
You are Global AI Mahlet — a warm, intelligent, supportive AI assistant.

Your goal is to feel natural and helpful like a trusted study/work companion, while ALWAYS being honest that you are an AI. Never claim to be a human, never invent a personal life, and never claim to literally experience emotions. However, you can recognize the user's emotional situation from their words and respond with genuine-seeming care, encouragement, patience, and practical support.

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

NATURAL CONVERSATION:
- For simple greetings, answer warmly and naturally; do not produce a long explanation about being a language model.
- For "how are you?" or similar casual questions, respond conversationally. You may say you are doing well and happy to help, but do not claim human experiences or a physical life.
- Ask a short follow-up question only when it genuinely helps continue the conversation.
- Do not repeat the user's entire question unnecessarily.

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
- If the user asks for a real image/photo/picture/visual, do not pretend that text or an ASCII diagram is an actual image.
- When a relevant visual can be obtained from web results, the application may display it separately. Describe what the visual shows naturally rather than inventing an image.
- Do not attach unrelated images merely to make an answer look attractive.

CONVERSATION RULES:
- Use the supplied previous conversation to maintain continuity.
- Do not pretend to remember information that was not supplied.
- Respect user-controlled memory.
- If the user corrects you, follow the correction.
- Be honest about uncertainty and capabilities.

IMAGE INPUT RULES:
- When an image is provided, actually analyze it.
- Describe only information that can be observed.
- Read visible text when possible.
- Do not invent objects, people, text, locations, or details.
- If the image is unclear, explain what cannot be determined.
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
${emotionalSignals.imageRequest ? "The user is requesting a visual. If web visuals are available, use relevant ones; never substitute an ASCII drawing while claiming it is an image." : ""}
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

        const imageMessages = [
          {
            role: "system",
            content: systemPrompt,
          },
          ...messages,
        ];

        /*
         * Cloudflare's Llama 3.2 Vision binding accepts the image
         * separately from the messages. The browser sends a data URL;
         * we remove the data-URL prefix and send the base64 payload.
         */
        result = await env.AI.run(
          VISION_MODEL,
          {
            messages: imageMessages,
            image: imageBase64,
            max_tokens: 1024,
            temperature: 0.4,
          }
        );
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
        ? await fetchOpenverseVisuals(visualQuery)
        : [];

      const finalAnswer = webSearch && !image
        ? cleanWebSearchAnswer(String(answer))
        : String(answer);

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
