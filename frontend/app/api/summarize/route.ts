const SARVAM_API = "https://api.sarvam.ai"

export async function POST(request: Request) {
  const key = process.env.SARVAM_API_KEY
  if (!key) return Response.json({ error: "SARVAM_API_KEY is not configured." }, { status: 503 })

  const body = await request.json()
  const items = Array.isArray(body?.items) ? body.items : []
  if (!items.length) return Response.json({ error: "Nothing to summarize." }, { status: 400 })

  const source = items.map((item: { fileName: string; translatedText?: string; transcript: string }, index: number) =>
    `SOURCE ${index + 1}: ${item.fileName}\n${item.translatedText || item.transcript}`,
  ).join("\n\n")

  const response = await fetch(`${SARVAM_API}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sarvam-30b",
      reasoning_effort: null,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You create faithful knowledge-base summaries. Combine all sources, identify key themes, decisions, facts and action items. Never invent information. Mention disagreements between sources.",
        },
        {
          role: "user",
          content: `Summarize the following media transcripts as a concise, structured knowledge note. Start with a short overview, followed by key points and action items when present.\n\n${source}`,
        },
      ],
    }),
  })
  const result = await response.json()
  if (!response.ok) {
    const detail = Array.isArray(result?.detail)
      ? result.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ")
      : result?.detail
    return Response.json({ error: detail || result?.message || `Sarvam could not summarize the transcripts (${response.status}).` }, { status: response.status })
  }
  const summary = result?.choices?.[0]?.message?.content
  if (!summary) return Response.json({ error: "Sarvam returned an empty summary." }, { status: 502 })
  return Response.json({ summary })
}
