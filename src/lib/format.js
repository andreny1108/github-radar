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
 * 把每周提交数折算成 SVG polyline 的点串（viewBox 100×32）。
 *
 * 归一化用的是"0 到本仓库峰值"而不是"本仓库最小值到最大值"：
 * 后者会把一个每周稳定 2 次提交的项目也拉成剧烈起伏的锯齿，看着像很活跃。
 * 从 0 起算，平稳的项目就是一条低平线，停更的项目直接贴底——一眼能分辨。
 *
 * 数据点少于 4 个返回 null（拿不到统计的仓库），卡片据此不画图。
 */
export function sparkPoints(values) {
  if (!values || values.length < 4) return null

  const max = Math.max(...values)
  if (max === 0) return null // 一年没有任何提交，画条直线没意义

  const step = 100 / (values.length - 1)
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(30 - (v / max) * 28).toFixed(1)}`)
    .join(' ')
}

/** 曲线右端（最近几周）还有没有提交——决定曲线用强调色还是灰色 */
export function isActive(values) {
  if (!values?.length) return false
  return values.slice(-6).some((v) => v > 0)
}
