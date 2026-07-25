import { daysAgo } from './env.mjs'

/**
 * 每个仓库保留的历史快照条数。40 天够算周/月增量，也不会让文件无限膨胀。
 */
export const STAR_HISTORY_MAX = 40

/**
 * star 历史存成一行紧凑字符串："2026-07-25:48213,2026-07-26:48500"
 *
 * 为什么不用对象数组：data/repos.json 每天都要 commit，而它是带缩进的
 * （不缩进 git diff 没法看）。对象数组一条要占 4 行，4000 个仓库 × 40 条历史
 * 就是 15 MB 的纯格式开销。压成一行后，每个仓库每天只多几个字符，
 * diff 也仍然是一行一行的、看得懂。
 */
function parseEntry(part) {
  const i = part.indexOf(':')
  return { d: part.slice(0, i), s: Number(part.slice(i + 1)) }
}

function readHistory(repo) {
  // 兼容早期的对象数组格式，读到就地转换
  if (Array.isArray(repo.starHistory)) {
    repo.h = repo.starHistory.map((e) => `${e.d}:${e.s}`).join(',')
    delete repo.starHistory
  }
  return repo.h ? repo.h.split(',') : []
}

/** 追加一条 star 快照。同一天重复跑会覆盖而不是追加。 */
export function pushStarHistory(repo, date, stars) {
  const parts = readHistory(repo)
  const last = parts.at(-1)

  if (last && parseEntry(last).d === date) {
    parts[parts.length - 1] = `${date}:${stars}`
  } else {
    parts.push(`${date}:${stars}`)
  }

  if (parts.length > STAR_HISTORY_MAX) parts.splice(0, parts.length - STAR_HISTORY_MAX)
  repo.h = parts.join(',')
}

/**
 * 最近 n 天的 star 增量。
 *
 * 历史不足 2 条（第一天运行）时返回 null —— 前端据此显示 "—"，
 * 这是预期行为不是 bug：没有昨天的快照就算不出增量。
 */
export function starDelta(repo, days) {
  const parts = readHistory(repo)
  if (parts.length < 2) return null

  const cutoff = daysAgo(days)
  const latest = parseEntry(parts.at(-1))
  // 取第一条不早于 cutoff 的记录作基线；窗口内没数据就退回最老的一条
  const baseline = parseEntry(parts.find((p) => parseEntry(p).d >= cutoff) ?? parts[0])
  if (baseline.d === latest.d) return null

  return latest.s - baseline.s
}
