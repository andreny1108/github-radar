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

const W = 100 // viewBox 宽
const H = 32 // viewBox 高
const PAD = 3 // 上下留白，给平滑曲线的过冲留余地，否则峰值会被裁成平顶

/**
 * 把每周提交数折算成 SVG path（viewBox 100×32），返回折线和填充面积两条路径。
 *
 * 归一化用的是"0 到本仓库峰值"，不是"本仓库最小值到最大值"。差别在衰减项目上：
 * 一个曾经每周 40 次提交、近半年掉到 0 的项目，用 0 起算会明显俯冲到底部；
 * 用 min-max 的话那条曲线会被重新拉满整个高度，衰减完全看不出来。
 * 代价是曲线只表达"相对自身峰值的形状"，不表达绝对量级——
 * 每周稳定 3 次和稳定 30 次画出来都是贴顶的平线。这是 sparkline 的常规取舍。
 *
 * 曲线用 Catmull-Rom 转三次贝塞尔做平滑。26 个周数据点直接连折线是锯齿状，
 * 平滑之后才像"趋势"。张力取 0.5 而不是标准的 1：提交数是尖峰型数据，
 * 张力太高时曲线会在峰谷之间大幅过冲，甚至冲出画布被裁掉。
 *
 * 数据点少于 4 个返回 null（拿不到统计的仓库），卡片据此不画图。
 */
export function sparkPath(values) {
  if (!values || values.length < 4) return null

  const max = Math.max(...values)
  if (max === 0) return null // 一年没有任何提交，画条直线没意义

  const step = W / (values.length - 1)
  const pts = values.map((v, i) => [i * step, H - PAD - (v / max) * (H - PAD * 2)])

  const clampY = (y) => Math.max(0, Math.min(H, y))
  const n = (x) => x.toFixed(1)

  let line = `M${n(pts[0][0])},${n(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    // 端点没有前驱/后继时用自身代替，等价于把曲线在两端"夹平"
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const T = 0.5

    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * T
    const c1y = clampY(p1[1] + ((p2[1] - p0[1]) / 6) * T)
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * T
    const c2y = clampY(p2[1] - ((p3[1] - p1[1]) / 6) * T)

    line += `C${n(c1x)},${n(c1y)} ${n(c2x)},${n(c2y)} ${n(p2[0])},${n(p2[1])}`
  }

  // 面积 = 折线 + 沿右边落到底 + 沿底边回到左 + 闭合
  return { line, area: `${line}L${W},${H}L0,${H}Z` }
}

/** 曲线右端（最近几周）还有没有提交——决定曲线用强调色还是灰色 */
export function isActive(values) {
  if (!values?.length) return false
  return values.slice(-6).some((v) => v > 0)
}
