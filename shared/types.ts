/** 业务类型：定义作品、分类、状态和查询条件。 */
export type Category = 'novel' | 'anime' | 'movie' | 'galgame'
export type HomeCategory = Category | 'all'
export type Status = 'wish' | 'doing' | 'done'

export interface Item {
  id: number
  category: Category
  title: string
  originalTitle: string
  year: number | null
  producer: string // 动画：制作公司 / 视觉小说：开发商 / 电影：导演 / 书籍：作者
  coverPath: string // 本地缓存的封面文件名，空字符串表示无封面
  status: Status
  rating: number | null // 0~10，步进 0.5，null 表示未评分
  review: string
  tags: string[]
  source: string // 数据来源：Bangumi、NeoDB 或手动录入
  sourceId: string
  createdAt: number
  updatedAt: number
}

export type ItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>

export interface ItemFilter {
  category?: Category
  status?: Status
  keyword?: string
  tag?: string
}
