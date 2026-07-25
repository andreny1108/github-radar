import { useEffect, useRef, useState } from 'react'
import RepoCard from './RepoCard.jsx'

const PAGE = 60

/**
 * 分批渲染。一次性挂三千张卡会让首屏明显卡顿，
 * 用 IntersectionObserver 滚到底再加载下一批。
 */
export default function RepoGrid({ repos, categoryNames }) {
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
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--color-neutral-600)' }}>
        <h4 style={{ color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>没有找到匹配的项目</h4>
        <div style={{ fontSize: 14 }}>换一个关键词或分类试试</div>
      </div>
    )
  }

  return (
    <>
      <div
        className="gr-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 'var(--space-6)', // 卡片的角标画在边框外，间距太小会互相打架
        }}
      >
        {repos.slice(0, limit).map((repo) => (
          <RepoCard key={repo.id} repo={repo} categoryName={categoryNames[repo.cat] ?? '其他'} />
        ))}
      </div>

      {limit < repos.length && (
        <div
          ref={sentinel}
          style={{
            padding: '40px 0',
            textAlign: 'center',
            fontSize: 12,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-neutral-600)',
          }}
        >
          正在加载更多… {limit} / {repos.length}
        </div>
      )}
    </>
  )
}
