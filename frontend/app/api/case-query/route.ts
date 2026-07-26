import { listCases } from "@/lib/case-store"

const SARVAM_API = "https://api.sarvam.ai"

export async function POST(request: Request) {
  const key = process.env.SARVAM_API_KEY
  if (!key) return Response.json({ error: "SARVAM_API_KEY is not configured." }, { status: 503 })
  const { caseId, question, theory, attack } = await request.json()
  const analysis = (await listCases()).find((item) => item.id === caseId)
  if (!analysis) return Response.json({ error: "Case analysis not found." }, { status: 404 })
  if (!question && !theory) return Response.json({ error: "Enter a question or case theory." }, { status: 400 })

  const evidence = JSON.stringify({
    overview: analysis.overview,
    entities: analysis.entities,
    claims: analysis.claims,
    events: analysis.events,
    contradictions: analysis.contradictions,
    missingEvidence: analysis.missingEvidence,
  })
  const instruction = theory
    ? `${attack ? "Attack" : "Evaluate"} this case theory: "${theory}". Break it into necessary propositions, rate evidence coverage for each as strong/good/mixed/weak/unsupported, identify the weakest proposition, contradictions, missing proof and alternative explanations.`
    : `Answer this question: "${question}".`

  const response = await fetch(`${SARVAM_API}/v1/chat/completions`, {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sarvam-30b",
      reasoning_effort: null,
      temperature: 0.1,
      max_tokens: 1800,
      messages: [
        { role: "system", content: "Answer only from the supplied evidence graph. Do not infer legal truth. Cite claim IDs and sourceRef values in square brackets after every factual sentence. Clearly say when evidence is insufficient." },
        { role: "user", content: `${instruction}\n\nEVIDENCE GRAPH:\n${evidence}` },
      ],
    }),
  })
  const body = await response.json()
  if (!response.ok) return Response.json({ error: body?.detail || body?.message || "Sarvam query failed." }, { status: response.status })
  return Response.json({ answer: body?.choices?.[0]?.message?.content || "" })
}
