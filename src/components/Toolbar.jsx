import { SORTS } from '../lib/filter.js'

/**
 * 分类 chips + 排序 + 语言筛选。
 *
 * 原设计里没有语言筛选（它只有 14 个假数据）。真实站有近三千个项目、
 * 五十多种语言，这个筛选很有用，所以补了一个 select——用设计系统的
 * .input 类，视觉上和其他控件是一套。
 */
export default function Toolbar({
  categories,
  counts,
  total,
  active,
  onCategory,
  sort,
  onSort,
  lang,
  onLang,
  languages,
  hasDelta,
}) {
  const chips = [{ id: null, name: '全部', count: total }, ...categories.map((c) => ({
    id: c.id,
    name: c.name,
    count: counts[c.id] ?? 0,
  }))]

  return (
    <section
      className="gr-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3) 0',
        borderTop: '1px solid var(--color-divider)',
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      <div className="chip-row">
        {chips.map((chip) => (
          <button
            key={chip.id ?? 'all'}
            type="button"
            onClick={() => onCategory(chip.id)}
            className={`btn ${chip.id === active ? 'btn-primary' : 'btn-secondary'}`}
            // 数量为 0 的分类淡出但不隐藏——隐藏会让工具栏在搜索时不停跳动
            style={chip.count === 0 && chip.id !== active ? { opacity: 0.45 } : undefined}
          >
            {chip.name}
            <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 4 }}>{chip.count}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <select
          className="input"
          value={lang ?? ''}
          onChange={(e) => onLang(e.target.value || null)}
          style={{ width: 'auto', minWidth: 130 }}
          aria-label="按编程语言筛选"
        >
          <option value="">全部语言</option>
          {languages.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name}（{l.count}）
            </option>
          ))}
        </select>

        <div className="seg">
          {SORTS.map((s) => {
            const disabled = s.id === 'trending' && !hasDelta
            return (
              <button
                key={s.id}
                type="button"
                className="seg-opt"
                aria-pressed={s.id === sort}
                disabled={disabled}
                title={disabled ? '需要至少两天的数据快照，明天就有了' : undefined}
                onClick={() => onSort(s.id)}
              >
                {s.name}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
