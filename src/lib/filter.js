/**
 * 筛选 / 搜索 / 排序的纯函数。
 *
 * 全部逻辑放这里、组件只管渲染，是为了以后加筛选维度（比如按 license、
 * 按收录时间）不用动组件树，也方便直接对这些函数写测试。
 */

export const SORTS = [
  { id: 'trending', name: '本周新星' },
  { id: 'stars', name: 'Star 最多' },
  { id: 'updated', name: '最近更新' },
  { id: 'newest', name: '最新收录' },
]

/**
 * 建索引。1000 条其实全表扫也不卡，但建了索引之后
 * 涨到 5000 条也不用重写，成本只有一次 O(n)。
 */
export function buildIndex(repos) {
  const byCat = new Map()
  for (const repo of repos) {
    if (!byCat.has(repo.cat)) byCat.set(repo.cat, [])
    byCat.get(repo.cat).push(repo)
  }
  // 搜索用的小写拼接串，预先算好，避免每次输入都重新拼
  const haystack = new Map(
    repos.map((r) => [
      r.id,
      `${r.id} ${r.desc} ${r.zh} ${r.topics.join(' ')} ${r.lang ?? ''}`.toLowerCase(),
    ]),
  )
  return { byCat, haystack }
}

/** 多关键词按空格分隔，全部命中才算匹配（AND 而不是 OR） */
export function matchesQuery(repo, query, haystack) {
  if (!query) return true
  const text = haystack.get(repo.id) ?? ''
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => text.includes(term))
}

export function sortRepos(repos, sort) {
  const sorted = [...repos]
  switch (sort) {
    case 'stars':
      return sorted.sort((a, b) => b.stars - a.stars)
    case 'updated':
      return sorted.sort((a, b) => (a.pushed < b.pushed ? 1 : -1))
    case 'newest':
      // 同一天收录的项目很多，用 star 数做次级排序，否则顺序看起来是随机的
      return sorted.sort((a, b) => (a.seen < b.seen ? 1 : a.seen > b.seen ? -1 : b.stars - a.stars))
    case 'trending':
    default:
      // null（历史不足）排在最后，而不是被当成 0 混在中间
      return sorted.sort((a, b) => {
        const av = a.d7 ?? -1
        const bv = b.d7 ?? -1
        return bv - av || b.stars - a.stars
      })
  }
}

/**
 * 一次算出：过滤后的列表 + 每个分类的实时数量。
 *
 * 数量必须在应用"分类"筛选之前算——否则选中某个分类后，
 * 其他分类的角标会全变成 0，侧边栏就没法用了。
 */
export function applyFilters(repos, { query, lang, category, sort }, haystack) {
  const preCategory = repos.filter(
    (r) => matchesQuery(r, query, haystack) && (!lang || r.lang === lang),
  )

  const counts = {}
  for (const r of preCategory) counts[r.cat] = (counts[r.cat] ?? 0) + 1

  const filtered = category ? preCategory.filter((r) => r.cat === category) : preCategory

  return { repos: sortRepos(filtered, sort), counts, total: preCategory.length }
}
