/**
 * ③ 产出前端要 fetch 的 public/data/repos.json
 *
 * 主库 data/repos.json 里有很多前端用不到的东西（README 摘要、完整 star 历史、
 * 打分中间结果）。这一步把它们剔掉，只留渲染需要的字段，并预先算好 star 增量——
 * 增量在前端算需要时区处理，在构建时算一次更省事也更快。
 */

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, writeJson, today } from './lib/env.mjs'
import { starDelta } from './lib/stars.mjs'
import { CATEGORIES } from './taxonomy.mjs'

const store = readJson('data/repos.json', { repos: {} })
const all = Object.values(store.repos ?? {})
// 活跃度曲线（近 26 周每周提交数），卡片上那条线画的就是它
const activity = readJson('data/activity.json', {})

if (!all.length) {
  console.error('❌ data/repos.json 是空的，请先跑 npm run fetch')
  process.exit(1)
}

const active = all.filter((r) => !r.archived)

const repos = active.map((r) => ({
  id: r.id,
  // url 能从 id 推出来（github.com/<id>），不必每条都存一遍
  // 描述截到 200 字：卡片最多显示 3 行约 120 字，多出来的只有搜索用得上
  desc: (r.description ?? '').slice(0, 200),
  zh: r.summaryZh ?? '',
  stars: r.stars,
  forks: r.forks,
  lang: r.language ?? null,
  topics: (r.topics ?? []).slice(0, 5),
  cat: r.category ?? 'other',
  // 时间只保留日期，前端不显示时分秒
  pushed: (r.pushedAt ?? '').slice(0, 10),
  created: (r.createdAt ?? '').slice(0, 10),
  seen: r.firstSeen,
  d7: starDelta(r, 7),   // 本周新增 star，null = 历史不足（第一天运行时全是 null）
  d30: starDelta(r, 30),
  act: activity[r.id]?.w ?? [], // 近 26 周每周提交数，卡片曲线
}))

// 默认按本周新增排序，前端切换排序时无需重排整个数组
repos.sort((a, b) => (b.d7 ?? -1) - (a.d7 ?? -1) || b.stars - a.stars)

// 语言列表按出现次数排序，前端筛选器直接用
const langCount = {}
for (const r of repos) if (r.lang) langCount[r.lang] = (langCount[r.lang] ?? 0) + 1
const languages = Object.entries(langCount)
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => ({ name, count }))

const catCount = {}
for (const r of repos) catCount[r.cat] = (catCount[r.cat] ?? 0) + 1

writeJson(
  'public/data/repos.json',
  {
    updatedAt: store.updatedAt ?? new Date().toISOString(),
    buildDate: today(),
    hasDelta: repos.some((r) => r.d7 !== null), // 前端据此决定"本周新星"排序是否可用
    // 首屏三块数据牌用的统计
    newToday: repos.filter((r) => r.seen === today()).length,
    totalActive: repos.length,
    categories: CATEGORIES.map((c) => ({ ...c, count: catCount[c.id] ?? 0 })).filter(
      (c) => c.count > 0,
    ),
    languages: languages.slice(0, 20),
    repos,
  },
  { minify: true },
)

const withZh = repos.filter((r) => r.zh).length
const sizeKb = Math.round(
  fs.statSync(path.join(ROOT, 'public/data/repos.json')).size / 1024,
)

console.log(`📦 已生成 public/data/repos.json`)
console.log(`   活跃项目 ${repos.length} 个（隐藏沉寂项目 ${all.length - active.length} 个）`)
console.log(`   中文摘要 ${withZh}/${repos.length}（${Math.round((withZh / repos.length) * 100)}%）`)
console.log(`   语言 ${languages.length} 种，文件 ${sizeKb} KB（传输时会 gzip 到约 ${Math.round(sizeKb / 4.5)} KB）`)
if (!repos.some((r) => r.d7 !== null)) {
  console.log(`   ℹ️  暂无 star 增量数据——需要至少两天的快照，明天再跑就有了`)
}
console.log(`\n下一步：npm run dev`)
