import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"

export type KnowledgeItem = {
  id: string
  collectionId: string
  fileName: string
  mediaType: string
  transcript: string
  translatedText?: string
  languageCode?: string
  createdAt: string
}

export type KnowledgeCollection = {
  id: string
  title: string
  summary: string
  targetLanguage?: string
  itemIds: string[]
  createdAt: string
}

type KnowledgeStore = {
  collections: KnowledgeCollection[]
  items: KnowledgeItem[]
}

const databasePath = join(process.cwd(), "data", "knowledge-base.json")
let writeQueue = Promise.resolve()

async function readStore(): Promise<KnowledgeStore> {
  try {
    return JSON.parse(await readFile(databasePath, "utf8")) as KnowledgeStore
  } catch {
    return { collections: [], items: [] }
  }
}

async function writeStore(store: KnowledgeStore) {
  await mkdir(dirname(databasePath), { recursive: true })
  const temporaryPath = `${databasePath}.tmp`
  await writeFile(temporaryPath, JSON.stringify(store, null, 2))
  await rename(temporaryPath, databasePath)
}

export async function listKnowledge(query = "") {
  const store = await readStore()
  const needle = query.trim().toLowerCase()
  if (!needle) return store
  const matchingItems = store.items.filter((item) =>
    [item.fileName, item.transcript, item.translatedText].some((value) => value?.toLowerCase().includes(needle)),
  )
  const collectionIds = new Set(matchingItems.map((item) => item.collectionId))
  return {
    items: matchingItems,
    collections: store.collections.filter((collection) =>
      collectionIds.has(collection.id) ||
      collection.title.toLowerCase().includes(needle) ||
      collection.summary.toLowerCase().includes(needle),
    ),
  }
}

export async function saveKnowledge(input: {
  title: string
  summary: string
  targetLanguage?: string
  items: Array<Omit<KnowledgeItem, "id" | "collectionId" | "createdAt">>
}) {
  const operation = writeQueue.then(async () => {
    const store = await readStore()
    const id = randomUUID()
    const createdAt = new Date().toISOString()
    const items = input.items.map((item) => ({
      ...item,
      id: randomUUID(),
      collectionId: id,
      createdAt,
    }))
    const collection: KnowledgeCollection = {
      id,
      title: input.title,
      summary: input.summary,
      targetLanguage: input.targetLanguage,
      itemIds: items.map((item) => item.id),
      createdAt,
    }
    store.collections.unshift(collection)
    store.items.unshift(...items)
    await writeStore(store)
    return { collection, items }
  })
  writeQueue = operation.then(() => undefined, () => undefined)
  return operation
}
