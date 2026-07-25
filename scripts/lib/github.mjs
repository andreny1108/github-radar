import { sleep } from './env.mjs'

const API = 'https://api.github.com'

/**
 * GitHub 的两套限流规则完全不同，踩过才知道：
 *   - Search API：认证后 30 次/分钟（未认证 10 次/分钟）—— 严得多，是主要瓶颈
 *   - 其他 REST：认证后 5000 次/小时（未认证只有 60 次/小时）
 * 所以搜索之间必须主动 sleep，普通请求不用。
 */
const SEARCH_INTERVAL_MS = process.env.GH_API_TOKEN ? 2200 : 7000

let lastSearchAt = 0

function headers() {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'github-radar',
  }
  if (process.env.GH_API_TOKEN) h.Authorization = `Bearer ${process.env.GH_API_TOKEN}`
  return h
}

/** 带重试的请求。处理 403/429 限流、5xx 抖动。 */
async function request(url, { raw = false, retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res
    try {
      res = await fetch(url, {
        headers: raw ? { ...headers(), Accept: 'application/vnd.github.raw' } : headers(),
      })
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(2000 * (attempt + 1))
      continue
    }

    if (res.ok) return raw ? res.text() : res.json()

    // 404 是正常情况（仓库改名/删除/没有 README），不重试，交给调用方判断
    if (res.status === 404) return null

    // 限流：优先信 Retry-After，其次信 x-ratelimit-reset
    if (res.status === 403 || res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const reset = Number(res.headers.get('x-ratelimit-reset'))
      let waitMs = 60_000
      if (retryAfter) waitMs = retryAfter * 1000
      else if (reset) waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000

      // 限流最多等 5 分钟，再久说明配额是真没了，直接抛错比干等着强
      if (waitMs > 300_000 || attempt === retries) {
        throw new Error(`GitHub 限流，剩余配额 ${res.headers.get('x-ratelimit-remaining')}，需等待 ${Math.round(waitMs / 1000)}s。检查 GH_API_TOKEN 是否有效。`)
      }
      console.warn(`   ⏳ 触发限流，等待 ${Math.round(waitMs / 1000)}s 后重试…`)
      await sleep(waitMs)
      continue
    }

    if (res.status >= 500 && attempt < retries) {
      await sleep(2000 * (attempt + 1))
      continue
    }

    throw new Error(`GitHub API ${res.status} ${res.statusText} — ${url}`)
  }
}

/**
 * 搜索仓库。返回的对象已经包含 star / 语言 / topics / license 等全部元数据，
 * 不需要再逐个查详情——这是整个抓取流程能省下大量请求的关键。
 */
export async function searchRepos(query, { perPage = 100, sort = 'stars' } = {}) {
  const wait = SEARCH_INTERVAL_MS - (Date.now() - lastSearchAt)
  if (wait > 0) await sleep(wait)
  lastSearchAt = Date.now()

  const url = `${API}/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=${perPage}`
  const data = await request(url)
  return data?.items ?? []
}

/** 查单个仓库详情。用于 trending 抓到但搜索没覆盖的项目。 */
export async function getRepo(fullName) {
  return request(`${API}/repos/${fullName}`)
}

/** 取 README 原文。GitHub 会自动找 README.md / readme.rst 等各种变体，不用我们猜文件名。 */
export async function getReadme(fullName, maxChars = 3000) {
  try {
    const text = await request(`${API}/repos/${fullName}/readme`, { raw: true, retries: 1 })
    if (!text) return ''
    return stripMarkdownNoise(text).slice(0, maxChars)
  } catch {
    return '' // README 取不到不影响主流程，降级用 description 分类
  }
}

/**
 * README 前面通常糊着一堆 badge 图片、HTML 标签和多语言链接，
 * 直接喂给分类器会严重稀释真正的信息。这里先洗一遍。
 */
function stripMarkdownNoise(md) {
  return md
    // 先清掉落单的代理对和控制字符。README 里 emoji 很多，后面按字符数截断时
    // 很容易从代理对中间切开，留下的半个字符会让 JSON 序列化产生非法转义。
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')           // HTML 注释
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // 图片（badge 全在这）
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')                  // 其余 HTML 标签
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // 链接只留文字
    .replace(/```[\s\S]*?```/g, ' ')           // 代码块
    .replace(/^[#>\-*=|\s]+$/gm, '')           // 纯符号行、分隔线
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 抓 GitHub Trending 页面。
 * GitHub 没有官方 trending API，只能解析 HTML。
 * 这条来源专捞"搜索 API 按 star 排不出来、但这几天突然爆发"的新项目。
 * 解析失败不影响主流程——它是补充来源，不是主力。
 */
export async function fetchTrending(since = 'weekly') {
  try {
    const res = await fetch(`https://github.com/trending?since=${since}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; github-radar)' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // 每个 trending 条目都带一个 /owner/repo/stargazers 链接，这个锚点比标题结构稳定得多
    const names = new Set()
    for (const m of html.matchAll(/href="\/([\w.-]+)\/([\w.-]+)\/stargazers"/g)) {
      names.add(`${m[1]}/${m[2]}`)
    }
    return [...names]
  } catch (err) {
    console.warn(`   ⚠️  Trending(${since}) 抓取失败，跳过这条来源：${err.message}`)
    return []
  }
}

/** 查当前剩余配额，用于开跑前的自检。 */
export async function getRateLimit() {
  const data = await request(`${API}/rate_limit`)
  return {
    core: data?.resources?.core,
    search: data?.resources?.search,
  }
}
