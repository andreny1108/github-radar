import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  // 输入防抖：不加的话每敲一个字都要过一遍 1000 条数据
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

  if (error) {
    return (
      <Centered>
        <div className="mb-2 text-3xl">😵</div>
        <p className="mb-1 font-medium">数据加载失败：{error}</p>
        <p className="text-sm text-ink-3">本地开发请先跑 npm run data 生成数据文件</p>
      </Centered>
    )
  }

  if (!data) {
    return (
      <Centered>
        <div className="mb-3 text-3xl">🛰️</div>
        <p className="text-ink-3">正在加载项目数据…</p>
      </Centered>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        categories={data.categories}
        counts={counts}
        total={total}
        active={category}
        onSelect={setCategory}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="min-w-0 flex-1 px-4 pb-12 md:px-6">
        <Toolbar
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={setSort}
          lang={lang}
          onLang={setLang}
          languages={data.languages}
          hasDelta={data.hasDelta}
          onMenu={() => setMenuOpen(true)}
        />

        <RepoGrid repos={repos} />

        <footer className="mt-10 border-t border-border pt-5 text-xs text-ink-3">
          共收录 {data.repos.length} 个项目 · 数据更新于{' '}
          {new Date(data.updatedAt).toLocaleString('zh-CN')} · 每天早上 6 点自动刷新
        </footer>
      </main>
    </div>
  )
}

function Centered({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  )
}
