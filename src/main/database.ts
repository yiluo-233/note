/** 本地数据层：维护 SQLite 表结构、作品增删改查和标签查询。 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'node:path'
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

type ItemRow = Omit<
  Item,
  'originalTitle' | 'coverPath' | 'sourceId' | 'createdAt' | 'updatedAt' | 'tags'
> & {
  original_title: string
  cover_path: string
  source_id: string
  created_at: number
  updated_at: number
  tags: string
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    originalTitle: row.original_title,
    year: row.year,
    producer: row.producer,
    coverPath: row.cover_path,
    status: row.status,
    rating: row.rating,
    review: row.review,
    tags: JSON.parse(row.tags),
    source: row.source,
    sourceId: row.source_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function itemParams(input: ItemInput): Record<string, SQLInputValue> {
  return {
    category: input.category,
    title: input.title.trim(),
    original_title: input.originalTitle,
    year: input.year,
    producer: input.producer,
    cover_path: input.coverPath,
    status: input.status,
    rating: input.rating,
    review: input.review,
    tags: JSON.stringify([...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))]),
    source: input.source,
    source_id: input.sourceId
  }
}

export function listItems(filter: ItemFilter = {}): Item[] {
  const where: string[] = []
  const args: Record<string, SQLInputValue> = {}
  if (filter.category) {
    where.push('category = @category')
    args.category = filter.category
  }
  if (filter.status) {
    where.push('status = @status')
    args.status = filter.status
  }
  if (filter.keyword) {
    where.push('(title LIKE @kw OR original_title LIKE @kw)')
    args.kw = `%${filter.keyword}%`
  }
  if (filter.tag) {
    where.push('EXISTS (SELECT 1 FROM json_each(items.tags) WHERE value = @tag)')
    args.tag = filter.tag
  }
  const sql = `SELECT * FROM items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC`
  return (db.prepare(sql).all(args) as ItemRow[]).map(toItem)
}

function getItem(id: number): Item | null {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined
  return row ? toItem(row) : null
}

/** 来源判重只读取标识，避免反复加载封面、备注和标签等完整资料。 */
export function hasSourceItem(source: string, sourceId: string): boolean {
  return !!db
    .prepare('SELECT 1 FROM items WHERE source = ? AND source_id = ?')
    .get(source, sourceId)
}

export function listSourceKeys(): Set<string> {
  const rows = db.prepare('SELECT source, source_id FROM items').all()
  return new Set(rows.map((row) => `${row.source}:${row.source_id}`))
}

export function addItem(input: ItemInput): Item {
  if (
    ['bangumi', 'neodb'].includes(input.source) &&
    input.sourceId &&
    hasSourceItem(input.source, input.sourceId)
  ) {
    throw new Error('该作品已在书架中')
  }
  const now = Date.now()
  const info = db
    .prepare(
      `INSERT INTO items (category,title,original_title,year,producer,cover_path,status,rating,review,tags,source,source_id,created_at,updated_at)
       VALUES (@category,@title,@original_title,@year,@producer,@cover_path,@status,@rating,@review,@tags,@source,@source_id,@now,@now)`
    )
    .run({ ...itemParams(input), now })
  return getItem(Number(info.lastInsertRowid))!
}

export function updateItem(id: number, input: ItemInput): Item | null {
  db.prepare(
    `UPDATE items SET category=@category,title=@title,original_title=@original_title,year=@year,producer=@producer,
     cover_path=@cover_path,status=@status,rating=@rating,review=@review,tags=@tags,source=@source,source_id=@source_id,
     updated_at=@now WHERE id=@id`
  ).run({ ...itemParams(input), now: Date.now(), id })
  return getItem(id)
}

export function deleteItem(id: number): void {
  db.prepare('DELETE FROM items WHERE id = ?').run(id)
}

export function listTags(): string[] {
  return db
    .prepare('SELECT DISTINCT value FROM items, json_each(items.tags) ORDER BY value')
    .all()
    .map((row) => row.value as string)
}

export function deleteItems(ids: number[]): void {
  if (!Array.isArray(ids) || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('无效作品 ID')
  }
  if (!ids.length) {
    return
  }
  db.exec('BEGIN IMMEDIATE')
  try {
    const statement = db.prepare('DELETE FROM items WHERE id = ?')
    for (const id of new Set(ids)) {
      statement.run(id)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
