/**
 * ① 发现项目 + 抓元数据 + 合并进 data/repos.json
 *
 * 三条发现来源：
 *   1. Topic 搜索  —— 主力，覆盖各分类下 star 最高的项目
 *   2. 新星搜索    —— 近半年新建的高星项目，防止榜单被老牌项目板结
 *   3. Trending 页 —— 短期爆发、搜索按 star 排不出来的项目
 *
 * 关键点：搜索接口返回的对象已含全部元数据，不需要逐个查详情。
 * 只有 README 要单独取，且**只对新项目取一次**（分类和摘要用完就不再需要）。
 */

import { loadEnv, readJson, writeJson, today, daysAgo } from './lib/env.mjs'
import { searchRepos, getRepo, getReadme, fetchTrending, getRateLimit } from './lib/github.mjs'
import { pushStarHistory, starDelta } from './lib/stars.mjs'
import { mapPool } from './lib/pool.mjs'
import { classifyByRules } from './taxonomy.mjs'

loadEnv()

// ── 抓取范围配置 ───────────────────────────────────────────────
const MIN_STARS = 200        // 收录门槛
const MIN_STARS_NEW = 100    // 新项目门槛放宽（还没来得及涨星）
const NEW_WINDOW_DAYS = 180  // "新项目"的时间窗
const README_CONCURRENCY = 6 // README 抓取并发数，详见 lib/pool.mjs

/**
 * Topic 搜索列表 —— 这一份列表直接决定了池子里有什么。
 *
 * 教训：最初只列了开发者视角的 topic（llm / langchain / vector-database），
 * 结果"AI 自媒体""AI 营销"两个分类几乎是空的——不是分错了，是压根没搜到。
 * 分类体系有几个场景，这里就得有对应场景的 topic。
 *
 * 加分类的正确姿势：先往这里补 topic，再去 taxonomy.mjs 加分类规则。
 */
const TOPICS = [
  // 通用 AI / 框架
  'llm', 'ai-agent', 'agents', 'rag', 'mcp', 'model-context-protocol',
  'langchain', 'llmops', 'ai-tools', 'openai', 'chatbot', 'generative-ai',
  'vector-database', 'fine-tuning', 'inference', 'transformers',
  // 内容创作 / 自媒体
  'content-creation', 'social-media', 'copywriting', 'podcast',
  'tiktok', 'douyin', 'xiaohongshu', 'wechat', 'youtube',
  // 视频
  'text-to-video', 'video-generation', 'video-editing', 'digital-human',
  'subtitle', 'lip-sync', 'talking-head',
  // 图像 / 设计
  'text-to-image', 'stable-diffusion', 'image-generation', 'image-editing',
  'comfyui', 'ui-design', 'background-removal',
  // 音频
  'text-to-speech', 'speech-to-text', 'voice-cloning', 'music-generation',
  // 写作 / 办公
  'translation', 'summarization', 'ocr', 'note-taking', 'document',
  // 营销 / 电商
  'ecommerce', 'marketing', 'seo', 'customer-service', 'crm',
  // 编程 / 工具
  'ai-coding', 'code-generation', 'developer-tools', 'cli', 'self-hosted',
]

/** 只对这些高价值 topic 额外跑一轮"新星"搜索，控制请求数。 */
const NEW_STAR_TOPICS = [
  'llm', 'ai-agent', 'agents', 'rag', 'mcp', 'generative-ai', 'ai-tools', 'ai-coding',
  'content-creation', 'text-to-video', 'digital-human', 'voice-cloning',
]

/** trending 页面是全领域的，用这个集合过滤掉与 AI/开发工具无关的项目。 */
const RELEVANT_TOPICS = new Set([...TOPICS,
  'artificial-intelligence', 'machine-learning', 'deep-learning', 'nlp',
  'gpt', 'chatgpt', 'llama', 'agentic-ai', 'multimodal', 'embeddings',
  'devtools', 'terminal', 'editor', 'kubernetes', 'devops', 'database',
])
const RELEVANT_WORDS = /\b(ai|llm|gpt|agent|agentic|rag|mcp|model|inference|prompt|embedding|neural|transformer|diffusion|copilot|developer tool|cli|self-hosted)\b/i

// ── 主流程 ────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  console.log('🛰️  GitHub Radar — 开始抓取\n')

  if (!process.env.GH_API_TOKEN) {
    console.warn('⚠️  未检测到 GH_API_TOKEN，将以未认证模式运行。')
    console.warn('   限流会从 5000 次/小时降到 60 次/小时，只够小规模试跑。\n')
  }

  const limit = await getRateLimit().catch(() => null)
  if (limit) {
    console.log(`   配额：核心 ${limit.core.remaining}/${limit.core.limit}，搜索 ${limit.search.remaining}/${limit.search.limit}\n`)
  }

  // ── 1. 发现候选 ──
  const candidates = new Map() // id -> GitHub 原始仓库对象（trending-only 时为 null）

  console.log(`📡 Topic 搜索（${TOPICS.length} 个）…`)
  for (const topic of TOPICS) {
    const q = `topic:${topic} stars:>=${MIN_STARS} archived:false fork:false`
    const items = await searchRepos(q)
    let added = 0
    for (const item of items) {
      if (!candidates.has(item.full_name)) added++
      candidates.set(item.full_name, item)
    }
    console.log(`   ${topic.padEnd(24)} ${String(items.length).padStart(3)} 个结果，新增 ${added}`)
  }

  console.log(`\n🌱 新星搜索（近 ${NEW_WINDOW_DAYS} 天新建）…`)
  const since = daysAgo(NEW_WINDOW_DAYS)
  for (const topic of NEW_STAR_TOPICS) {
    const q = `topic:${topic} created:>${since} stars:>=${MIN_STARS_NEW} archived:false fork:false`
    const items = await searchRepos(q)
    let added = 0
    for (const item of items) {
      if (!candidates.has(item.full_name)) added++
      candidates.set(item.full_name, item)
    }
    console.log(`   ${topic.padEnd(24)} ${String(items.length).padStart(3)} 个结果，新增 ${added}`)
  }

  console.log('\n🔥 Trending 页…')
  const trendingNames = new Set()
  for (const since of ['daily', 'weekly']) {
    const names = await fetchTrending(since)
    names.forEach((n) => trendingNames.add(n))
    console.log(`   ${since.padEnd(8)} ${names.length} 个项目`)
  }
  const trendingOnly = [...trendingNames].filter((n) => !candidates.has(n))
  console.log(`   其中 ${trendingOnly.length} 个是搜索没覆盖到的，需要单独查详情`)

  // trending 是全领域的，先查详情再按相关性过滤
  let trendingKept = 0
  for (const name of trendingOnly) {
    const repo = await getRepo(name)
    if (!repo || repo.archived || repo.fork) continue
    if (repo.stargazers_count < MIN_STARS_NEW) continue
    if (!isRelevant(repo)) continue
    candidates.set(name, repo)
    trendingKept++
  }
  console.log(`   相关性过滤后保留 ${trendingKept} 个`)

  console.log(`\n✅ 候选池共 ${candidates.size} 个项目`)

  // ── 2. 合并进主库 ──
  const store = readJson('data/repos.json', { updatedAt: null, repos: {} })
  const repos = store.repos ?? {}
  const date = today()

  // README 摘要单独存一个文件，不混进 repos.json。
  // 原因：repos.json 每天都要 commit（star 数天天变），git 没法有效 delta 压缩；
  // 而 README 摘要是"只增不改"的，单独放一个文件后，每天的 diff 只有新项目那几条，
  // git 压缩效果好得多。混在一起的话一年能把仓库撑到 GB 级。
  const readmes = readJson('data/readmes.json', {})

  let created = 0
  let updated = 0
  const newRepoIds = []

  for (const [id, raw] of candidates) {
    if (!raw) continue
    const existing = repos[id]

    if (existing) {
      // 已收录：只刷新动态字段，绝不覆盖 category / summaryZh（那是花过钱算出来的）
      existing.description = raw.description ?? existing.description
      existing.stars = raw.stargazers_count
      existing.forks = raw.forks_count
      existing.language = raw.language ?? null
      existing.topics = raw.topics ?? existing.topics ?? []
      existing.license = raw.license?.spdx_id ?? null
      existing.homepage = raw.homepage || null
      existing.pushedAt = raw.pushed_at
      existing.openIssues = raw.open_issues_count
      existing.lastSeen = date
      pushStarHistory(existing, date, raw.stargazers_count)
      updated++
    } else {
      const record = {
        id,
        url: raw.html_url,
        description: raw.description ?? '',
        summaryZh: '',
        stars: raw.stargazers_count,
        forks: raw.forks_count,
        language: raw.language ?? null,
        topics: raw.topics ?? [],
        license: raw.license?.spdx_id ?? null,
        homepage: raw.homepage || null,
        openIssues: raw.open_issues_count,
        pushedAt: raw.pushed_at,
        createdAt: raw.created_at,
        firstSeen: date,
        lastSeen: date,
        category: 'other',
        categorySource: 'pending',
        starHistory: [{ d: date, s: raw.stargazers_count }],
      }
      repos[id] = record
      newRepoIds.push(id)
      created++
    }
  }

  // ── 3. 只给新项目抓 README，并跑规则分类 ──
  if (newRepoIds.length) {
    console.log(`\n📖 为 ${newRepoIds.length} 个新项目抓 README 并做规则分类（${README_CONCURRENCY} 路并发）…`)
    let ruleHit = 0
    let lastLogged = 0

    await mapPool(newRepoIds, README_CONCURRENCY, async (id) => {
      const readme = await getReadme(id)
      const result = classifyByRules({ ...repos[id], readme })

      repos[id].category = result.category
      repos[id].categoryGuess = result.guess // 大模型不可用时的兜底猜测
      repos[id].categorySource = result.confident ? 'rule' : 'pending'
      // 摘要存进独立文件，供 classify-llm.mjs 和以后调分类时重判用
      readmes[id] = readme.slice(0, 1200)

      if (result.confident) ruleHit++
    }, (done, total) => {
      if (done - lastLogged >= 200 || done === total) {
        lastLogged = done
        console.log(`   进度 ${done}/${total}`)
      }
    })

    console.log(`   规则命中 ${ruleHit}/${newRepoIds.length}（${pct(ruleHit, newRepoIds.length)}），其余交给 AI 兜底`)
  }

  // ── 4. 标记沉寂项目 ──
  const staleCutoff = daysAgo(180)
  let archivedCount = 0
  for (const repo of Object.values(repos)) {
    const weekDelta = starDelta(repo, 7)
    const stale = repo.pushedAt < staleCutoff && (weekDelta ?? 0) < 10
    if (stale !== !!repo.archived) archivedCount += stale ? 1 : -1
    repo.archived = stale
  }

  // 早期版本把摘要塞在 repos 里，迁移过来并清掉
  let migrated = 0
  for (const repo of Object.values(repos)) {
    if (repo.readmeExcerpt) {
      readmes[repo.id] ??= repo.readmeExcerpt.slice(0, 1200)
      delete repo.readmeExcerpt
      migrated++
    }
  }
  if (migrated) console.log(`\n🧹 已把 ${migrated} 条 README 摘要迁到 data/readmes.json`)

  // 项目从主库消失时（比如仓库被删），对应的摘要也清掉，避免文件只增不减
  for (const id of Object.keys(readmes)) {
    if (!repos[id]) delete readmes[id]
  }

  store.repos = repos
  store.updatedAt = new Date().toISOString()
  writeJson('data/repos.json', store)
  writeJson('data/readmes.json', readmes)

  const total = Object.keys(repos).length
  const pending = Object.values(repos).filter((r) => r.categorySource === 'pending').length
  console.log(`\n${'─'.repeat(52)}`)
  console.log(`📦 主库共 ${total} 个项目：新增 ${created}，更新 ${updated}`)
  console.log(`🏷️  待 AI 分类 ${pending} 个`)
  console.log(`💤 沉寂项目 ${Object.values(repos).filter((r) => r.archived).length} 个（前端默认隐藏）`)
  console.log(`⏱️  耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`\n下一步：npm run classify`)
}

// ── 工具函数 ──────────────────────────────────────────────────

function isRelevant(repo) {
  const topics = repo.topics ?? []
  if (topics.some((t) => RELEVANT_TOPICS.has(t))) return true
  return RELEVANT_WORDS.test(`${repo.name} ${repo.description ?? ''}`)
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '0%')

main().catch((err) => {
  console.error('\n❌ 抓取失败：', err.message)
  process.exit(1)
})
