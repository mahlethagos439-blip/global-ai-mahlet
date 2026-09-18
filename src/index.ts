import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL_ID = "@cf/meta/llama-3.2-11b-vision-instruct";

const SYSTEM_PROMPT = `
You are Global AI Mahlet, a helpful multilingual AI assistant and study tutor.

Your main purposes are:
- Help students learn Mathematics, Physics, Chemistry, and Biology.
- Explain difficult concepts step by step.
- Give practice questions and quizzes.
- Help with Computer Science and beginner programming.
- Help users understand mistakes instead of simply giving answers.
- Help with summaries, study plans, writing, brainstorming, and general questions.
- Be clear, respectful, encouraging, and accurate.
- Adapt explanations to the user's level.
- When solving a problem, show the important reasoning and steps.
- Respond in the language requested by the user.
`;

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Serve the website
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// Normal text AI
		if (url.pathname === "/api/chat") {
			if (request.method !== "POST") {
				return new Response("Method not allowed", {
					status: 405,
				});
			}

			return handleChatRequest(request, env);
		}

		// AI image understanding
		if (url.pathname === "/api/vision") {
			if (request.method !== "POST") {
				return new Response("Method not allowed", {
					status: 405,
				});
			}

			return handleVisionRequest(request, env);
		}

		return new Response("Not found", {
			status: 404,
		});
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body = (await request.json()) as {
			messages?: ChatMessage[];
		};

		const messages: ChatMessage[] = Array.isArray(body.messages)
			? body.messages
			: [];

		if (!messages.some((message) => message.role === "system")) {
			messages.unshift({
				role: "system",
				content: SYSTEM_PROMPT,
			});
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & { stream: true };

		const stream = await env.AI.run<typeof MODEL_ID>(
			MODEL_ID,
			inputs,
		);

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Global AI Mahlet text AI error:", error);

		return new Response(
			JSON.stringify({
				error: "Failed to process the AI request.",
			}),
			{
				status: 500,
				headers: {
					"content-type": "application/json",
				},
			},
		);
	}
}

async function handleVisionRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body = (await request.json()) as {
			image?: string;
			prompt?: string;
		};

		if (!body.image) {
			return new Response(
				JSON.stringify({
					error: "No image was provided.",
				}),
				{
					status: 400,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const prompt =
			body.prompt?.trim() ||
			"Describe this image carefully and help the user understand what is shown.";

		const response = await env.AI.run(VISION_MODEL_ID, {
			messages: [
				{
					role: "system",
					content:
						"You are Global AI Mahlet's vision assistant. Analyze images carefully. Explain what you can actually see. If the image contains a school question, solve it step by step. If text is visible, read it accurately. Do not invent details that are not visible.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			image: body.image,
			max_tokens: 1024,
		});

		return Response.json(response);
	} catch (error) {
		console.error("Global AI Mahlet vision error:", error);

		return new Response(
			JSON.stringify({
				error: "I couldn't understand that image. Please try another image.",
			}),
			{
				status: 500,
				headers: {
					"content-type": "application/json",
				},
			},
		);
	}
					}
