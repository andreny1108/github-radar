/** 52134 → "52.1k" */
export function formatStars(n) {
  if (n >= 1000) {
    const k = n / 1000
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`
  }
  return String(n)
}

/** star 增量：null 表示历史不足（第一天运行），显示为 "—" */
export function formatDelta(d) {
  if (d === null || d === undefined || d <= 0) return '—'
  return `+${formatStars(d)}`
}

/** 相对时间：今天 / 3 天前 / 2 个月前 */
export function timeAgo(iso) {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days < 1) return '今天'
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 周前`
  if (days < 365) return `${Math.floor(days / 30)} 个月前`
  return `${Math.floor(days / 365)} 年前`
}

/**
 * 把 star 历史折算成 SVG polyline 的点串（viewBox 100×32）。
 *
 * 走的是"每张卡自己归一化"：把这个仓库自身的最小值贴底、最大值贴顶。
 * 不这么做的话，10 万 star 的项目涨 2000 和 500 star 的项目涨 200，
 * 在同一个绝对坐标系里后者会是一条完全看不出起伏的平线。
 *
 * 数据点少于 3 个返回 null（第一周还没攒够快照），卡片据此不画图。
 */
export function sparkPoints(values) {
  if (!values || values.length < 3) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = 100 / (values.length - 1)

  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(30 - ((v - min) / range) * 28).toFixed(1)}`)
    .join(' ')
}
