import { formatStars, formatDelta, timeAgo, langColor, deltaHeat } from '../lib/format.js'

const HEAT_CLASS = {
  hot: 'text-hot',
  warm: 'text-warm',
  mild: 'text-mild',
  none: 'text-ink-3',
}

export default function RepoCard({ repo }) {
  const [owner, name] = repo.id.split('/')
  const heat = deltaHeat(repo.d7)

  return (
    <a
      // 链接由 id 拼出来，不必在数据里每条都存一遍完整 URL
      href={`https://github.com/${repo.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-2.5 rounded-xl border border-border bg-surface-2 p-4 transition hover:border-accent/50 hover:shadow-lg hover:shadow-black/5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[15px] leading-snug font-semibold">
          <span className="block truncate text-ink-3">{owner}/</span>
          <span className="block truncate text-ink group-hover:text-accent">{name}</span>
        </h3>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-semibold tabular-nums text-ink">
            ★ {formatStars(repo.stars)}
          </div>
          <div className={`text-xs font-medium tabular-nums ${HEAT_CLASS[heat]}`}>
            {formatDelta(repo.d7)}
            {heat === 'hot' && ' 🔥'}
          </div>
        </div>
      </div>

      {/* 优先中文摘要；没有（未配 Claude key）就退回英文原描述 */}
      <p className="line-clamp-3 min-h-[3.4em] text-[13px] leading-[1.55] text-ink-2">
        {repo.zh || repo.desc || '（暂无描述）'}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-3">
        {repo.lang && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: langColor(repo.lang) }}
            />
            {repo.lang}
          </span>
        )}
        <span title={`最后提交 ${repo.pushed?.slice(0, 10)}`}>更新于 {timeAgo(repo.pushed)}</span>
      </div>

      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-3"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </a>
  )
}
