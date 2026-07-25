import { useEffect, useRef, useState } from 'react'
import RepoCard from './RepoCard.jsx'

const PAGE = 60

/**
 * 分批渲染。一次性挂 1000+ 张卡会让首屏明显卡顿，
 * 用 IntersectionObserver 滚到底再加载下一批。
 */
export default function RepoGrid({ repos }) {
  const [limit, setLimit] = useState(PAGE)
  const sentinel = useRef(null)

  // 筛选条件变了要回到第一页，否则切分类后还停在第 300 条的位置
  useEffect(() => setLimit(PAGE), [repos])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setLimit((n) => n + PAGE)
      },
      { rootMargin: '600px' }, // 提前 600px 触发，滚动时感觉不到加载
    )
    io.observe(el)
    return () => io.disconnect()
  }, [repos])

  if (!repos.length) {
    return (
      <div className="py-24 text-center text-ink-3">
        <div className="mb-2 text-3xl">🔍</div>
        没有匹配的项目，换个关键词或清掉筛选试试
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-3">
        {repos.slice(0, limit).map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </div>

      {limit < repos.length && (
        <div ref={sentinel} className="py-8 text-center text-sm text-ink-3">
          正在加载更多…（已显示 {limit} / {repos.length}）
        </div>
      )}
    </>
  )
}
