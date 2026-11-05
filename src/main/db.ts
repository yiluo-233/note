import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'path'
import type { Item, ItemFilter, ItemInput } from '../../shared/types'

let db: DatabaseSync

export function initDb(): void {
  db = new DatabaseSync(join(app.getPath('userData'), 'library.db'))
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK (category IN ('novel','anime','movie','galgame')),
      title TEXT NOT NULL,
      original_title TEXT NOT NULL DEFAULT '',
      year INTEGER,
      producer TEXT NOT NULL DEFAULT '',
      cover_path TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('wish','doing','done')),
      rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10 AND rating * 2 = CAST(rating * 2 AS INTEGER))),
      review TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
  `)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toItem(r: any): Item {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    originalTitle: r.original_title,
    year: r.year,
    producer: r.producer,
    coverPath: r.cover_path,
    status: r.status,
    rating: r.rating,
    review: r.review,
    tags: JSON.parse(r.tags),
    source: r.source,
    sourceId: r.source_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function params(i: ItemInput): Record<string, SQLInputValue> {
  return {
    category: i.category,
    title: i.title.trim(),
    original_title: i.originalTitle,
    year: i.year,
    producer: i.producer,
    cover_path: i.coverPath,
    status: i.status,
    rating: i.rating,
    review: i.review,
    tags: JSON.stringify([...new Set(i.tags.map((t) => t.trim()).filter(Boolean))]),
    source: i.source,
    source_id: i.sourceId
  }
}

export function listItems(f: ItemFilter = {}): Item[] {
  const where: string[] = []
  const args: Record<string, SQLInputValue> = {}
  if (f.category) {
    where.push('category = @category')
    args.category = f.category
  }
  if (f.status) {
    where.push('status = @status')
    args.status = f.status
  }
  if (f.keyword) {
    where.push('(title LIKE @kw OR original_title LIKE @kw)')
    args.kw = `%${f.keyword}%`
  }
  if (f.tag) {
    where.push('EXISTS (SELECT 1 FROM json_each(items.tags) WHERE value = @tag)')
    args.tag = f.tag
  }
  const sql = `SELECT * FROM items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC`
  return db.prepare(sql).all(args).map(toItem)
}

export function getItem(id: number): Item | null {
  const r = db.prepare('SELECT * FROM items WHERE id = ?').get(id)
  return r ? toItem(r) : null
}

export function addItem(input: ItemInput): Item {
  if (
    ['bangumi', 'neodb'].includes(input.source) &&
    input.sourceId &&
    db
      .prepare('SELECT id FROM items WHERE source = ? AND source_id = ?')
      .get(input.source, input.sourceId)
  )
    throw new Error('该作品已在书架中')
  const now = Date.now()
  const info = db
    .prepare(
      `INSERT INTO items (category,title,original_title,year,producer,cover_path,status,rating,review,tags,source,source_id,created_at,updated_at)
       VALUES (@category,@title,@original_title,@year,@producer,@cover_path,@status,@rating,@review,@tags,@source,@source_id,@now,@now)`
    )
    .run({ ...params(input), now })
  return getItem(Number(info.lastInsertRowid))!
}

export function updateItem(id: number, input: ItemInput): Item | null {
  db.prepare(
    `UPDATE items SET category=@category,title=@title,original_title=@original_title,year=@year,producer=@producer,
     cover_path=@cover_path,status=@status,rating=@rating,review=@review,tags=@tags,source=@source,source_id=@source_id,
     updated_at=@now WHERE id=@id`
  ).run({ ...params(input), now: Date.now(), id })
  return getItem(id)
}

export function deleteItem(id: number): void {
  db.prepare('DELETE FROM items WHERE id = ?').run(id)
}

export function listTags(): string[] {
  return db
    .prepare('SELECT DISTINCT value FROM items, json_each(items.tags) ORDER BY value')
    .all()
    .map((r) => (r as unknown as { value: string }).value)
}

export function deleteItems(ids: number[]): void {
  if (!Array.isArray(ids) || ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
    throw new Error('无效作品 ID')
  db.exec('BEGIN IMMEDIATE')
  try {
    const statement = db.prepare('DELETE FROM items WHERE id = ?')
    for (const id of new Set(ids)) statement.run(id)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
