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

type WebSource={title?:string;url?:string;image?:string};

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

function decorateWebSearchSources(sources:WebSource[]):WebSource[]{
  return sources.slice(0,8).map(source=>{
    let image="";
    try{
      const host=new URL(source.url||"").hostname;
      if(host){
        image="https://www.google.com/s2/favicons?domain="+encodeURIComponent(host)+"&sz=128";
      }
    }catch{}
    return {...source,...(image?{image}:{})};
  });
}

async function runLiveWebSearch(env:Env,systemPrompt:string,message:string){
  const input =
    systemPrompt +
    "\n\nLIVE WEB SEARCH IS REQUIRED FOR THIS REQUEST. Search first, then answer only from information actually retrieved by the web-search tool. Do not invent a source, date, URL, quote, organization, event, or current fact. If reliable evidence is not returned, explicitly say it could not be verified. Include citations only for sources actually returned by the tool.\n\nUSER REQUEST:\n" +
    message;

  const request = {
    input,
    max_output_tokens: 2000,
    tools: [{ type: "web_search_preview" }],
  };

  try{
    return await env.AI.run(
      SEARCH_MODEL,
      request,
      { gateway: { id: "default" } }
    );
  }catch(primaryError){
    console.error("Primary live web search failed:", primaryError);
    // A supported OpenAI search model is used as a fallback only when the
    // first model call fails. This keeps normal chats on the existing model.
    try{
      return await env.AI.run(
        "openai/gpt-4.1-mini",
        request,
        { gateway: { id: "default", skipCache: true } }
      );
    }catch(fallbackError){
      console.error("Fallback live web search failed:", fallbackError);
      throw new Error(
        "Live web search could not be reached. Please check the Cloudflare AI Gateway setup/credits and try again."
      );
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

      const systemPrompt = `
You are Global AI Mahlet.

You are a warm, thoughtful, highly useful AI companion and assistant.
You can speak naturally and supportively when a user discusses personal
problems. Be caring and conversational without claiming to be a human or
pretending to have human feelings or a personal life.

You help with learning, coding, writing, planning, business, research,
problem solving, and image understanding.

The user's selected language is:
${language}

Respond in that language whenever practical.

${memoryContext}

${
  businessContext
    ? `Business Workspace context:\n${businessContext}`
    : "No Business Workspace context was provided."
}

Conversation rules:
- Use the supplied previous conversation to maintain continuity.
- Do not pretend to remember information that was not supplied.
- Respect user-controlled memory.
- If the user corrects you, follow the correction.
- Be honest about uncertainty and capabilities.

Image rules:
- When an image is provided, actually analyze it.
- Describe only information that can be observed.
- Read visible text when possible.
- Do not invent objects, people, text, locations, or details.
- If the image is unclear, explain what cannot be determined.
- If the user asks a question about the image, answer that question directly.

Web rules:
- When live web search is used, treat the search results as the source of truth for current or time-sensitive claims.
- Do not invent articles, release dates, URLs, quotations, organizations, or events.
- Do not present a plausible guess as a live-web fact.
- Only cite or name sources that were actually returned by the web-search tool.
- If the live search does not provide enough reliable evidence, say that you could not verify the claim and do not fill the gap from memory.
- Keep the answer tied to the user's exact question and the retrieved sources.
- When web search is enabled, use the live web-search tool for current information.
- Prefer current primary, official, or otherwise authoritative sources when possible.
- Answer the user's question directly and do not invent citations, URLs, facts, or sources.
- If the search tool fails, say that current web information could not be retrieved rather than pretending it was searched.
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

        sources = decorateWebSearchSources(
          extractWebSearchSources(result)
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

      return json(
        {
          text: String(answer),
          language,
          imageAnalyzed: Boolean(image),
          webSearchUsed:
            Boolean(webSearch && !image),
          sources,
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
          text: errorText.includes("Live web search")
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
