/**
 * 有并发上限的批量执行。
 *
 * 为什么需要：抓 2000+ 个 README 时，瓶颈是网络往返而不是 GitHub 配额
 * （核心接口 5000 次/小时，够用）。串行跑要 45 分钟，6 路并发只要 6 分钟。
 *
 * 为什么不开更大：GitHub 有"次级限流"，会对短时间内的请求突发做限制。
 * 6 路是实测下来既快又不触发的档位。
 */
export async function mapPool(items, concurrency, fn, onProgress) {
  const results = new Array(items.length)
  let next = 0
  let done = 0

  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
      done++
      onProgress?.(done, items.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}
