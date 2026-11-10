/** 搜索文本处理：统一全半角、大小写及空白标点，计算标题匹配程度。 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

/** 查询词由调用方预先标准化；完整匹配优先于包含匹配。 */
export function titleMatchScore(title: string, query: string): number {
  const normalized = normalizeSearchText(title)
  if (normalized === query) {
    return 2
  }
  return normalized.includes(query) ? 1 : 0
}
