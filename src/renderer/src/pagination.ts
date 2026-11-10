/** 分页导航：生成页码与省略号组成的展示列表。 */
export function paginationPages(total: number, current: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  if (current >= total - 5) {
    return ['…', ...Array.from({ length: 7 }, (_, i) => total - 6 + i)]
  }
  return [current, current + 1, current + 2, '…', total - 2, total - 1, total]
}
