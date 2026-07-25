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
  if (d === null || d === undefined) return '—'
  if (d <= 0) return '—'
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
 * 语言色点。用的是 GitHub 官方 linguist 的配色，
 * 开发者对这套颜色有肌肉记忆，自己另配一套反而认知成本更高。
 */
const LANG_COLORS = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Jupyter: '#DA5B0B',
  'Jupyter Notebook': '#DA5B0B',
  Dart: '#00B4AB',
  Lua: '#000080',
  Zig: '#ec915c',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  Cuda: '#3A4E3A',
  MDX: '#fcb32c',
  Dockerfile: '#384d54',
}

export const langColor = (lang) => LANG_COLORS[lang] ?? '#8b949e'

/** 增量热度：决定卡片上增量数字的颜色强度 */
export function deltaHeat(d) {
  if (!d || d <= 0) return 'none'
  if (d >= 1000) return 'hot'
  if (d >= 300) return 'warm'
  return 'mild'
}
