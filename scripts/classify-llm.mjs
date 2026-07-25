/**
 * ② 大模型兜底分类 + 中文摘要
 *
 * 只处理 categorySource === 'pending' 的项目（规则引擎判不准的那些）。
 * 结果永久缓存进 data/ai-cache.json——每个仓库这辈子只算一次，
 * 之后每天的更新只刷 star 数，不再产生任何 token 成本。
 *
 * 走 OpenAI 兼容协议，所以火山方舟 / DeepSeek / 通义 / 智谱 / Moonshot
 * 都能用，换厂商只改 .env 不改代码。
 *
 * 没配 key 时优雅降级：用规则引擎的最优猜测 + 英文原描述，
 * 站点照常能跑，只是场景分类不准、没有中文摘要。
 */

import OpenAI from 'openai'
import { loadEnv, readJson, writeJson, sleep } from './lib/env.mjs'
import { CATEGORIES, CATEGORY_IDS, CATEGORY_MENU, classifyByRules } from './taxonomy.mjs'

loadEnv()

/**
 * 各家的 OpenAI 兼容入口。baseURL 基本不变，模型名各家会更新，
 * 所以模型名做成可覆盖的——用之前去各家控制台确认一下当前可用的型号。
 */
const PROVIDERS = {
  volcengine: {
    label: '火山方舟',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    keyEnv: 'ARK_API_KEY',
    // 火山既接受模型名，也接受"推理接入点"ID（ep- 开头）
    defaultModel: 'doubao-seed-1-6-250615',
    console: 'https://console.volcengine.com/ark',
  },
  deepseek: {
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    keyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    console: 'https://platform.deepseek.com/api_keys',
  },
  qwen: {
    label: '通义千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyEnv: 'DASHSCOPE_API_KEY',
    defaultModel: 'qwen-plus',
    console: 'https://bailian.console.aliyun.com/',
  },
  zhipu: {
    label: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    keyEnv: 'ZHIPU_API_KEY',
    defaultModel: 'glm-4-flash',
    console: 'https://bigmodel.cn/usercenter/apikeys',
  },
  moonshot: {
    label: 'Moonshot Kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    keyEnv: 'MOONSHOT_API_KEY',
    defaultModel: 'moonshot-v1-8k',
    console: 'https://platform.moonshot.cn/console/api-keys',
  },
}

const PROVIDER_ID = process.env.LLM_PROVIDER ?? 'volcengine'
const provider = PROVIDERS[PROVIDER_ID]
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 12)
const CONCURRENCY = 3 // 同时跑几个批次，太高容易触发各家的 QPS 限制

// 合法分类（不含 other——让模型必须做出选择，判不了的由我们兜底而不是它偷懒）
const VALID = new Set(CATEGORY_IDS.filter((c) => c !== 'other'))

const SYSTEM = `你是一个 GitHub 开源项目的分类与介绍助手，服务对象是中文用户。

给你一批项目（仓库名、英文描述、topics、README 摘要），对每个项目做两件事。

【第一件事】category —— 按"这个项目能帮人干什么活"选一个最贴切的分类：
${CATEGORY_MENU}

分类要点：
- 判断依据是**用途**不是**技术**。一个视频生成模型选 video，不要因为它是 PyTorch 写的就选 model
- model 只给"模型权重本身、推理引擎、微调训练、本地跑模型"这类，不要当垃圾桶用
- devkit 只给"面向程序员的库/框架/SDK/MCP/命令行"，普通人用不了的才算
- 如果一个工具明确是给做小红书/抖音/公众号/播客的人用的，优先选 self-media

【第二件事】summaryZh —— 一句 25~40 字的中文介绍。

写 summaryZh 的要求（这是重点）：
- 说清楚"这个东西解决什么问题、给谁用"，不要直译英文描述
- 用大白话，别堆术语。反例："基于 Transformer 架构的高性能推理框架"
  正例："让大模型在自己电脑上跑起来，速度比原版快好几倍"
- 不要用"这是一个""该项目"开头，直接说功能
- 不要出现 emoji、markdown 标记、引号
- README 信息太少就基于仓库名和描述做最合理的推断，不要写"未知"

【输出格式】只输出一个 JSON 对象，不要有任何其他文字、不要用 markdown 代码块包裹：
{"results":[{"id":"原样返回不要改写","category":"上面列表里的英文 id","summaryZh":"中文介绍"}]}

必须为输入的每一个 id 返回一条结果。`

async function main() {
  const store = readJson('data/repos.json', { repos: {} })
  const repos = store.repos ?? {}
  const cache = readJson('data/ai-cache.json', {})
  // README 摘要独立存放，见 fetch-github.mjs 里的说明
  const readmes = readJson('data/readmes.json', {})

  const allRepos = Object.values(repos)
  if (!allRepos.length) {
    console.error('❌ data/repos.json 是空的，请先跑 npm run fetch')
    process.exit(1)
  }

  // ── 0. 分类体系变更后自愈 ──
  // 改了 taxonomy.mjs 之后，老数据里的分类可能已经不存在了。这里检测出来重跑规则引擎，
  // 用的是抓取时存下的 README 摘要，所以调分类体系永远不需要重新抓数据。
  //
  // 增删分类会被自动检测到；但只调关键词权重不会（分类 id 没变），
  // 这种情况加 --rules 参数强制全量重判：node scripts/classify-llm.mjs --rules
  const forceRules = process.argv.includes('--rules')
  const known = new Set(CATEGORY_IDS)
  const stale = allRepos.filter(
    (r) =>
      !known.has(r.category) ||
      r.categorySource === 'stale' ||
      // 强制重判时只动规则判的，AI 判过的保留（那是花过钱的结果）
      (forceRules && r.categorySource !== 'ai'),
  )
  if (stale.length) {
    console.log(`🔄 ${forceRules ? '强制重判' : '检测到分类体系有变更'}，正在用新规则处理 ${stale.length} 个项目…`)
    for (const repo of stale) {
      const result = classifyByRules({ ...repo, readme: readmes[repo.id] ?? '' })
      repo.category = result.category
      repo.categoryGuess = result.guess
      repo.categorySource = result.confident ? 'rule' : 'pending'
      repo.summaryZh = '' // 摘要也作废：旧摘要是按旧分类语境写的
    }
    console.log(`   规则重新命中 ${stale.filter((r) => r.categorySource === 'rule').length} 个\n`)
  }

  // ── 1. 先吃缓存 ──
  let cacheHits = 0
  for (const repo of allRepos) {
    const cached = cache[repo.id]
    // 分类体系改过之后，缓存里的旧分类可能已经不存在了，这种要重算
    if (!cached || !VALID.has(cached.category)) continue
    if (repo.categorySource !== 'ai' || !repo.summaryZh) {
      repo.category = cached.category
      repo.summaryZh = cached.summaryZh
      repo.categorySource = 'ai'
      cacheHits++
    }
  }

  const pending = allRepos.filter((r) => r.categorySource === 'pending')
  console.log(`🏷️  规则已确定 ${allRepos.filter((r) => r.categorySource === 'rule').length} 个`)
  console.log(`💾 缓存命中 ${cacheHits} 个`)
  console.log(`🤖 待大模型处理 ${pending.length} 个\n`)

  if (!pending.length) {
    finish(store, repos, cache)
    return
  }

  // ── 2. 没配 key 就降级 ──
  if (!provider) {
    console.error(`❌ 未知的 LLM_PROVIDER="${PROVIDER_ID}"，可选：${Object.keys(PROVIDERS).join(' / ')}`)
    process.exit(1)
  }
  const apiKey = process.env.LLM_API_KEY ?? process.env[provider.keyEnv]

  if (!apiKey) {
    console.warn(`⚠️  未检测到 ${provider.label} 的 API key，跳过大模型分类。`)
    console.warn(`   在 .env 里设 LLM_API_KEY=... 即可（申请地址 ${provider.console}）`)
    console.warn('   降级方案：用规则引擎的最优猜测 + 英文原描述。')
    console.warn('   站点功能完整，只是场景分类不准、没有中文摘要。')
    console.warn('   以后补上 key 再跑一次本脚本即可，不用重新抓数据。\n')
    for (const repo of pending) {
      repo.category = repo.categoryGuess ?? 'other'
      repo.categorySource = 'fallback'
    }
    finish(store, repos, cache)
    return
  }

  // ── 3. 批量调用 ──
  const model = process.env.LLM_MODEL ?? provider.defaultModel
  const client = new OpenAI({ apiKey, baseURL: provider.baseURL, maxRetries: 3, timeout: 120_000 })
  const batches = chunk(pending, BATCH_SIZE)

  console.log(`厂商 ${provider.label}，模型 ${model}`)
  console.log(`共 ${batches.length} 批（每批 ${BATCH_SIZE} 个，${CONCURRENCY} 路并发）\n`)

  const stats = { done: 0, failed: 0, input: 0, output: 0, batchesDone: 0 }
  let cursor = 0

  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= batches.length) return
      await runBatch(client, model, batches[i], cache, stats, readmes)
      stats.batchesDone++
      console.log(
        `   ${String(stats.batchesDone).padStart(3)}/${batches.length} 批完成` +
          `（成功 ${stats.done}，失败 ${stats.failed}）`,
      )
      await sleep(300)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  // 没处理成功的退回规则猜测，别让它们卡在 pending
  for (const repo of pending) {
    if (repo.categorySource === 'pending') {
      repo.category = repo.categoryGuess ?? 'other'
      repo.categorySource = 'fallback'
    }
  }

  console.log(`\n✅ 大模型分类完成 ${stats.done} 个，失败 ${stats.failed} 个`)
  console.log(`📊 token 用量：输入 ${stats.input.toLocaleString()}，输出 ${stats.output.toLocaleString()}`)
  if (stats.failed) {
    console.log('   （失败的下次重跑会自动补做，已成功的走缓存不重复付费）')
  }

  finish(store, repos, cache)
}

// ── 单批处理 ──────────────────────────────────────────────────

async function runBatch(client, model, batch, cache, stats, readmes) {
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildPrompt(batch, readmes) },
      ],
      // 各家对 json_object 的支持程度不一，所以还是要自己兜底解析
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 3000,
    })

    if (completion.usage) {
      stats.input += completion.usage.prompt_tokens ?? 0
      stats.output += completion.usage.completion_tokens ?? 0
    }

    const results = parseResults(completion.choices[0]?.message?.content ?? '')
    const byId = new Map(results.map((r) => [r.id, r]))

    for (const repo of batch) {
      const result = byId.get(repo.id)
      // 分类必须落在合法枚举里——模型偶尔会自创分类名或返回中文名
      if (!result || !VALID.has(result.category) || !result.summaryZh) {
        stats.failed++
        continue
      }
      repo.category = result.category
      repo.summaryZh = String(result.summaryZh).trim().slice(0, 60)
      repo.categorySource = 'ai'
      cache[repo.id] = { category: repo.category, summaryZh: repo.summaryZh }
      stats.done++
    }
  } catch (err) {
    stats.failed += batch.length
    console.warn(`   ⚠️  一批失败：${describeError(err)}`)
    if (err?.status === 429) await sleep(10_000)
  }
}

/**
 * 解析模型输出。
 * 即使要求了 json_object，有些厂商仍会用 ```json 包裹或加一句说明，
 * 所以这里做两层兜底：先直接解析，失败就抠出第一个 {...} 再试。
 */
function parseResults(text) {
  const tryParse = (s) => {
    try {
      const obj = JSON.parse(s)
      return Array.isArray(obj) ? obj : (obj.results ?? [])
    } catch {
      return null
    }
  }

  let out = tryParse(text.trim())
  if (out) return out

  const cleaned = text.replace(/^[\s\S]*?```(?:json)?\s*/i, '').replace(/```[\s\S]*$/, '')
  out = tryParse(cleaned.trim())
  if (out) return out

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    out = tryParse(text.slice(start, end + 1))
    if (out) return out
  }

  throw new Error('模型返回的内容不是合法 JSON')
}

// ── 工具函数 ──────────────────────────────────────────────────

function buildPrompt(batch, readmes) {
  const body = batch
    .map((repo, i) => {
      const parts = [
        `## ${i + 1}. id: ${repo.id}`,
        `star: ${repo.stars}｜语言: ${repo.language ?? '未知'}`,
        `topics: ${(repo.topics ?? []).slice(0, 12).join(', ') || '无'}`,
        `描述: ${repo.description || '无'}`,
      ]
      const readme = readmes[repo.id]
      if (readme) parts.push(`README 摘要: ${readme.slice(0, 1000)}`)
      return parts.join('\n')
    })
    .join('\n\n')

  return `${body}\n\n请按要求返回 JSON，共 ${batch.length} 条结果。`
}

function finish(store, repos, cache) {
  store.repos = repos
  writeJson('data/repos.json', store)
  writeJson('data/ai-cache.json', cache)

  const dist = {}
  for (const repo of Object.values(repos)) {
    if (repo.archived) continue
    dist[repo.category] = (dist[repo.category] ?? 0) + 1
  }
  const total = Object.values(dist).reduce((a, b) => a + b, 0)

  console.log(`\n📂 分类分布（共 ${total} 个活跃项目）`)
  for (const cat of CATEGORIES) {
    const n = dist[cat.id] ?? 0
    if (!n) continue
    const bar = '█'.repeat(Math.max(1, Math.round((n / total) * 40)))
    console.log(`   ${cat.emoji} ${cat.name.padEnd(20, '　')} ${String(n).padStart(4)} ${bar}`)
  }
  const otherPct = Math.round(((dist.other ?? 0) / total) * 100)
  if (otherPct > 10) {
    console.log(`\n   ⚠️  "其他"占 ${otherPct}%，偏高。可以往 scripts/taxonomy.mjs 的关键词表补规则。`)
  }

  console.log('\n下一步：npm run data')
}

const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size))

function describeError(err) {
  if (err?.status === 401) return 'API key 无效或没权限'
  if (err?.status === 429) return '触发速率限制，稍后重试'
  if (err?.status === 404) return `模型名不存在（检查 .env 里的 LLM_MODEL）`
  if (err?.status) return `HTTP ${err.status}：${err.message}`
  if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return '连不上服务器，检查网络'
  return err?.message ?? String(err)
}

main().catch((err) => {
  console.error('\n❌ 分类失败：', describeError(err))
  process.exit(1)
})
