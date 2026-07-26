const SARVAM_API = "https://api.sarvam.ai"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : []
  if (!items.length) return Response.json({ summary: "No extractable source content was available.", fallback: true })
  const fallback = `${items.length} source${items.length === 1 ? "" : "s"} processed: ${items.map((item: { fileName?: string }) => item.fileName || "Untitled source").join(", ")}.`
  const key = process.env.SARVAM_API_KEY
  if (!key) return Response.json({ summary: fallback, fallback: true, warning: "Sarvam summarization is not configured." })

  const source = items.map((item: { fileName: string; translatedText?: string; transcript: string }, index: number) =>
    `SOURCE ${index + 1}: ${item.fileName}\n${String(item.translatedText || item.transcript || "").slice(0, 18000)}`,
  ).join("\n\n").slice(0, 90000)

  try {
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
    const raw = await response.text()
    let result: Record<string, unknown> = {}
    try { result = JSON.parse(raw) } catch {
      return Response.json({ summary: fallback, fallback: true, warning: "Sarvam returned a non-JSON response." })
    }
    if (!response.ok) {
    const detail = Array.isArray(result?.detail)
      ? result.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ")
      : result?.detail
      return Response.json({ summary: fallback, fallback: true, warning: detail || result?.message || `Sarvam summary unavailable (${response.status}).` })
    }
    const resultChoices = result.choices as Array<{ message?: { content?: string } }> | undefined
    const summary = resultChoices?.[0]?.message?.content
    return Response.json({ summary: summary || fallback, fallback: !summary })
  } catch (caught) {
    return Response.json({ summary: fallback, fallback: true, warning: caught instanceof Error ? caught.message : "Summarization was skipped." })
  }
}
