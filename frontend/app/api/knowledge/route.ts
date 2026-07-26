import { listKnowledge, saveKnowledge } from "@/lib/knowledge-base"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") || ""
  return Response.json(await listKnowledge(query))
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body?.summary || !Array.isArray(body?.items) || body.items.length === 0) {
    return Response.json({ error: "A summary and at least one media item are required." }, { status: 400 })
  }
  return Response.json(await saveKnowledge(body), { status: 201 })
}
