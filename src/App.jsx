import { useEffect, useMemo, useState } from 'react'
import Toolbar from './components/Toolbar.jsx'
import RepoGrid from './components/RepoGrid.jsx'
import { applyFilters, buildIndex } from './lib/filter.js'

// 生产构建挂在 /github-radar/ 下，数据路径必须带上同样的前缀
const DATA_URL = `${import.meta.env.BASE_URL}data/repos.json`

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState(null)
  const [lang, setLang] = useState(null)
  const [sort, setSort] = useState('trending')

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  // 输入防抖：不加的话每敲一个字都要过一遍三千条数据
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150)
    return () => clearTimeout(t)
  }, [query])

  const index = useMemo(() => (data ? buildIndex(data.repos) : null), [data])

  // 第一天没有 star 增量，此时"本周新星"排序等同于按 star 排，
  // 自动切到 star 排序，免得用户以为站点坏了
  useEffect(() => {
    if (data && !data.hasDelta && sort === 'trending') setSort('stars')
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const { repos, counts, total } = useMemo(() => {
    if (!data) return { repos: [], counts: {}, total: 0 }
    return applyFilters(data.repos, { query: debounced, lang, category, sort }, index.haystack)
  }, [data, index, debounced, lang, category, sort])

  const categoryNames = useMemo(
    () => Object.fromEntries((data?.categories ?? []).map((c) => [c.id, c.name])),
    [data],
  )

  if (error) {
    return (
      <Centered>
        <h4>数据加载失败：{error}</h4>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-600)' }}>
          本地开发请先跑 <code>npm run data</code> 生成数据文件
        </p>
      </Centered>
    )
  }

  if (!data) {
    return (
      <Centered>
        <div style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>
          正在加载项目数据…
        </div>
      </Centered>
    )
  }

  // 首次建库那天，所有项目的 firstSeen 都是当天，"今日新增"会等于总数——
  // 数字没错但看着像坏了。这种情况显示 "—"，第二天起才是真正的日增量。
  const totalCollected = data.totalActive ?? data.repos.length
  const isFirstBuild = (data.newToday ?? 0) >= totalCollected
  const stats = [
    { value: isFirstBuild ? '—' : `+${data.newToday ?? 0}`, label: '今日新增项目' },
    { value: totalCollected.toLocaleString(), label: '累计收录项目' },
    { value: String(data.categories.length), label: '覆盖分类' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* 活跃度曲线的面积渐变。全局定义一次、各卡片按 id 引用——
          三千张卡各自内联一份 <defs> 纯属浪费。
          stop-color 写在 style 里而不是属性上，属性形式不解析 CSS 变量。 */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="spark-on" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id="spark-off" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--color-neutral-400)', stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-neutral-400)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
      </svg>

      {/* 原设计稿是 1240px 定宽（它只有 14 个假数据，窄一点更好看）。
          真实站有近三千个项目，宽屏下留两条大白边纯属浪费——放宽到 1720px，
          1440 屏能排 4 列、1920 屏 5 列。再宽就不放了：卡片行太长，
          眼睛从行尾扫回行首会找不着位置。 */}
      <div className="gr-container" style={{ maxWidth: 1720, margin: '0 auto', padding: 'var(--space-4) var(--space-8) 80px' }}>
        <div className="nav gr-nav" style={{ paddingInline: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              className="blueprint"
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
              <div style={{ width: 10, height: 10, background: 'var(--color-accent)' }} />
            </div>
            <div className="nav-brand">GitHub Radar</div>
          </div>
          <a href="https://github.com/andreny1108/github-radar" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            GitHub ↗
          </a>
        </div>

        <section style={{ margin: 'var(--space-8) 0' }}>
          <h6 style={{ color: 'var(--color-accent-700)', marginBottom: 'var(--space-3)' }}>Daily AI &amp; Dev Tool Discovery</h6>
          <h1 className="gr-h1" style={{ maxWidth: 760, marginBottom: 'var(--space-3)' }}>
            发现 AI 与开发工具的下一个爆款项目
          </h1>
          <p style={{ maxWidth: 560, color: 'var(--color-neutral-700)', fontSize: 16 }}>
            每日自动抓取 GitHub 上值得关注的 AI 与开发工具项目，按应用场景分类，追踪 star 增速，帮你抢先发现下一个明星仓库。
          </p>

          <div className="gr-stats" style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', margin: 'var(--space-8) 0 var(--space-6)' }}>
            {stats.map((s) => (
              <div key={s.label} className="blueprint" style={{ padding: 'var(--space-3) var(--space-4)', minWidth: 140 }}>
                <i className="corner tl" />
                <i className="corner tr" />
                <i className="corner bl" />
                <i className="corner br" />
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 28, color: 'var(--color-accent-800)' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="field" style={{ maxWidth: 480 }}>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索项目名称、简介或标签…"
            />
          </div>
        </section>

        <Toolbar
          categories={data.categories}
          counts={counts}
          total={total}
          active={category}
          onCategory={setCategory}
          sort={sort}
          onSort={setSort}
          lang={lang}
          onLang={setLang}
          languages={data.languages}
          hasDelta={data.hasDelta}
        />

        <div
          style={{
            fontSize: 12,
            color: 'var(--color-neutral-600)',
            marginBottom: 'var(--space-6)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          共 {repos.length} 个项目
        </div>

        <RepoGrid repos={repos} categoryNames={categoryNames} />

        <div
          style={{
            marginTop: 'var(--space-8)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--color-divider)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            fontSize: 12,
            color: 'var(--color-neutral-600)',
          }}
        >
          <span>GitHub Radar · 每天早上 6 点自动更新</span>
          <span>数据更新于 {new Date(data.updatedAt).toLocaleString('zh-CN')}</span>
        </div>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}
