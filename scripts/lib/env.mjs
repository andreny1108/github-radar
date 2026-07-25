import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..')

/**
 * 加载项目根目录的 .env（本地开发用）。
 * CI 上没有这个文件，环境变量由 GitHub Actions 的 secrets 直接注入，所以静默跳过。
 * 已存在的环境变量优先——CI 的 secrets 不会被本地文件覆盖。
 */
export function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (value && !process.env[key]) process.env[key] = value
  }
}

/** 读 JSON 文件，不存在就返回兜底值。 */
export function readJson(relPath, fallback) {
  const full = path.join(ROOT, relPath)
  if (!fs.existsSync(full)) return fallback
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'))
  } catch (err) {
    console.warn(`⚠️  ${relPath} 解析失败，当作空数据处理：${err.message}`)
    return fallback
  }
}

/**
 * 写 JSON 文件，自动建目录。
 *
 * 默认带缩进——data/ 下的文件要进 git，缩进后 diff 才看得懂。
 * 传 { minify: true } 用于前端数据：那份没人读，缩进纯属带宽浪费（能省三成）。
 */
export function writeJson(relPath, data, { minify = false } = {}) {
  const full = path.join(ROOT, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  const json = minify ? JSON.stringify(data) : JSON.stringify(data, null, 2) + '\n'
  fs.writeFileSync(full, json, 'utf8')
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** YYYY-MM-DD（UTC，和 GitHub Actions 的时区保持一致，避免跨时区产生重复日期） */
export const today = () => new Date().toISOString().slice(0, 10)

/** n 天前的 YYYY-MM-DD */
export function daysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
