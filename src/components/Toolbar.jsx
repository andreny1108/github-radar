import { SORTS } from '../lib/filter.js'

export default function Toolbar({
  query,
  onQuery,
  sort,
  onSort,
  lang,
  onLang,
  languages,
  hasDelta,
  onMenu,
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-surface/85 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onMenu}
          className="rounded-lg border border-border px-2.5 py-2 text-sm md:hidden"
          aria-label="打开分类导航"
        >
          ☰
        </button>

        <div className="relative min-w-45 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="搜索项目名、描述、标签…"
            className="w-full rounded-lg border border-border bg-surface-2 py-2 pr-3 pl-9 text-sm outline-none placeholder:text-ink-3 focus:border-accent"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id} disabled={s.id === 'trending' && !hasDelta}>
              {s.name}
              {s.id === 'trending' && !hasDelta ? '（明日可用）' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 语言 chips：只列最常见的，避免一行几十个把工具栏撑爆 */}
      <div className="thin-scroll mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
        <Chip active={!lang} onClick={() => onLang(null)}>
          全部语言
        </Chip>
        {languages.slice(0, 12).map((l) => (
          <Chip key={l.name} active={lang === l.name} onClick={() => onLang(lang === l.name ? null : l.name)}>
            {l.name} <span className="opacity-60">{l.count}</span>
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition ${
        active
          ? 'border-accent bg-accent/12 text-accent'
          : 'border-border text-ink-2 hover:border-ink-3'
      }`}
    >
      {children}
    </button>
  )
}
