import { listKnowledge } from "@/lib/knowledge-base"

const SARVAM_API = "https://api.sarvam.ai"

export async function POST(request: Request) {
  const key = process.env.SARVAM_API_KEY
  if (!key) return Response.json({ error: "SARVAM_API_KEY is not configured." }, { status: 503 })
  const { question } = await request.json()
  if (!question?.trim()) return Response.json({ error: "Enter a question." }, { status: 400 })
  const store = await listKnowledge()
  if (!store.items.length) return Response.json({ error: "Upload and process evidence before asking questions." }, { status: 400 })

  const evidence = store.items.map((item, index) =>
    `[SOURCE-${index + 1}] ${item.fileName}\n${item.translatedText || item.transcript}`,
  ).join("\n\n")
  const response = await fetch(`${SARVAM_API}/v1/chat/completions`, {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sarvam-30b",
      reasoning_effort: null,
      temperature: 0.1,
      max_tokens: 1800,
      messages: [
        { role: "system", content: "Answer only from the supplied case evidence. Cite [SOURCE-N] after each factual statement. If evidence is insufficient, say so. Do not give a legal conclusion." },
        { role: "user", content: `QUESTION: ${question}\n\nCASE EVIDENCE:\n${evidence}` },
      ],
    }),
  })
  const body = await response.json()
  if (!response.ok) return Response.json({ error: body?.detail || body?.message || "Sarvam could not answer." }, { status: response.status })
  return Response.json({
    answer: body?.choices?.[0]?.message?.content || "",
    sources: store.items.map((item, index) => ({ id: index + 1, fileName: item.fileName })),
  })
}
