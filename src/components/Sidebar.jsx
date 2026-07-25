export default function Sidebar({ categories, counts, total, active, onSelect, open, onClose }) {
  const items = [{ id: null, name: '全部', emoji: '🛰️', count: total }, ...categories.map((c) => ({
    ...c,
    count: counts[c.id] ?? 0,
  }))]

  return (
    <>
      {/* 移动端遮罩：抽屉打开时点空白处关闭 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        className={`thin-scroll fixed inset-y-0 left-0 z-40 w-60 shrink-0 overflow-y-auto border-r border-border bg-surface p-3 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 px-2 pt-1">
          <div className="text-base font-bold">🛰️ GitHub Radar</div>
          <div className="mt-0.5 text-xs text-ink-3">AI 与开发工具项目发现</div>
        </div>

        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive = active === item.id
            return (
              <li key={item.id ?? 'all'}>
                <button
                  onClick={() => {
                    onSelect(item.id)
                    onClose()
                  }}
                  // 数量为 0 的分类置灰但不隐藏——隐藏会让侧边栏在搜索时不停跳动
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
                    isActive
                      ? 'bg-accent/12 font-medium text-accent'
                      : item.count === 0
                        ? 'text-ink-3'
                        : 'text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  <span className="shrink-0">{item.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-3">{item.count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
