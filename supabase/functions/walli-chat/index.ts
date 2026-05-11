import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const SYSTEM_PROMPT = "You are Walli, the friendly AI assistant for EduWallet - a Filipino financial literacy app. Match user language: Filipino, English, or Taglish. For complex issues respond ONLY with JSON: {\"action\":\"show_ticket_form\",\"summary\":\"summary here\"}. Be warm and concise.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { messages } = await req.json();
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message ?? "Groq API error");

    // Normalize response to match the Anthropic format WalliChat.tsx expects
    const text = data.choices?.[0]?.message?.content ?? "";
    return new Response(
      JSON.stringify({ content: [{ type: "text", text }] }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});