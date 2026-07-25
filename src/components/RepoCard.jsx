import { formatStars, formatDelta, timeAgo, sparkPoints } from '../lib/format.js'

/**
 * 蓝图风格的项目卡片。
 * 四个 <i class="corner"> 是设计系统的定位标记，画在边框外侧。
 */
export default function RepoCard({ repo, categoryName }) {
  const up = repo.d7 !== null && repo.d7 > 0
  const points = sparkPoints(repo.sp)

  return (
    <a
      href={`https://github.com/${repo.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="card blueprint repo-card"
    >
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        <span className="tag tag-outline">{categoryName}</span>
        {repo.lang && <span className="tag tag-neutral">{repo.lang}</span>}
      </div>

      <div className="card-title" style={{ wordBreak: 'break-word' }}>
        {repo.id.split('/')[1]}
        <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--color-neutral-600)', fontFamily: 'var(--font-body)' }}>
          {repo.id.split('/')[0]}
        </span>
      </div>

      {/* 优先中文摘要；没有（比如大模型那批失败了）就退回英文原描述 */}
      <p className="card-body">{repo.zh || repo.desc || '暂无描述'}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 16,
            color: 'var(--color-accent-800)',
          }}
        >
          ★ {formatStars(repo.stars)}
        </div>
        <span className={`tag ${up ? 'tag-accent' : 'tag-neutral'}`}>
          {up ? `▲ ${formatDelta(repo.d7)}` : '本周 —'}
        </span>
      </div>

      {/* 走势图只在攒够 3 天快照后才画：两个点是条直线，没信息量还占地方 */}
      {points && (
        <svg viewBox="0 0 100 32" style={{ width: '100%', height: 32, display: 'block' }} aria-hidden="true">
          <polyline
            points={points}
            fill="none"
            stroke={up ? 'var(--color-accent)' : 'var(--color-neutral-500)'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      <div className="card-meta" style={{ justifyContent: 'space-between' }}>
        <span title={`最后提交 ${repo.pushed}`}>更新于 {timeAgo(repo.pushed)}</span>
        <span className="btn btn-ghost" style={{ paddingInline: 0 }}>
          查看仓库 →
        </span>
      </div>
    </a>
  )
}
