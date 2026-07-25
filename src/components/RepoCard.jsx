import { formatStars, formatDelta, timeAgo, sparkPath, isActive } from '../lib/format.js'

/**
 * 蓝图风格的项目卡片。
 * 四个 <i class="corner"> 是设计系统的定位标记，画在边框外侧。
 */
export default function RepoCard({ repo, categoryName }) {
  const up = repo.d7 !== null && repo.d7 > 0
  const spark = sparkPath(repo.act)
  const active = isActive(repo.act)

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

      {/* 活跃度曲线：近 26 周每周提交数。最近半年没提交的画成灰色，一眼看出烂尾项目。
          拿不到统计的仓库（新建的、空的）不画，留空位保持卡片高度一致。 */}
      <div style={{ height: 32 }} title={spark ? '近半年每周提交数' : undefined}>
        {spark && (
          <svg
            viewBox="0 0 100 32"
            // 默认的等比缩放会让 100×32 的 viewBox 在 280×32 的容器里
            // 只占 100px 宽然后居中；none 才会横向拉满
            preserveAspectRatio="none"
            style={{ width: '100%', height: 32, display: 'block' }}
            aria-hidden="true"
          >
            {/* 先铺面积再压折线：32px 高的小图里光一条细线太弱，
                填充之后趋势的"体量感"才出得来 */}
            <path d={spark.area} fill={`url(#${active ? 'spark-on' : 'spark-off'})`} stroke="none" />
            <path
              d={spark.line}
              fill="none"
              stroke={active ? 'var(--color-accent)' : 'var(--color-neutral-400)'}
              strokeWidth="1.5"
              // 横向拉伸会把竖线抻粗、横线压细，这个属性让线宽不受缩放影响
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="card-meta" style={{ justifyContent: 'space-between' }}>
        <span title={`最后提交 ${repo.pushed}`}>更新于 {timeAgo(repo.pushed)}</span>
        <span className="btn btn-ghost" style={{ paddingInline: 0 }}>
          查看仓库 →
        </span>
      </div>
    </a>
  )
}
