const EMAIL_TOKEN_REGEX = /[^\s/\\()[\]{}<>:;"',]+@[^\s/\\()[\]{}<>:;"',]+/g

export function maskEmailLike(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^([^@\s]{1,3})[^@\s]*@(.+)$/)
  if (!match)
    return trimmed
  return `${match[1]}***@${match[2]}`
}

function splitFileExtension(value: string) {
  const slashIndex = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
  const dotIndex = value.lastIndexOf('.')

  if (dotIndex <= slashIndex + 1 || dotIndex >= value.length - 1) {
    return { base: value, suffix: '' }
  }

  return {
    base: value.slice(0, dotIndex),
    suffix: value.slice(dotIndex),
  }
}

export function maskAccountText(value?: string | null): string {
  const trimmed = String(value || '').trim()
  if (!trimmed || trimmed === '-' || trimmed === '—')
    return trimmed

  // 1. 如果包含邮箱，替换为 3 位前缀 + *** + @domain（如 20030112lrr+ww1@gmail.com -> 200***@gmail.com）
  const maskedEmailText = trimmed.replace(EMAIL_TOKEN_REGEX, match => maskEmailLike(match))
  if (maskedEmailText !== trimmed)
    return maskedEmailText

  // 2. 如果包含标准 API Key 格式（如 sk-..., sess-..., ghp_...）
  const apiKeyMatch = trimmed.match(/^(sk-proj-[A-Za-z0-9-_]{6,}|sk-ant-[A-Za-z0-9-_]{6,}|sk-[A-Za-z0-9-_]{6,}|sess-[A-Za-z0-9-_]{6,})/i)
  if (apiKeyMatch) {
    const key = apiKeyMatch[0]
    const prefix = key.slice(0, 4)
    const suffix = key.slice(-4)
    return `${prefix}***${suffix}`
  }

  // 3. 如果是文件名或普通长账号标识（如 personal-codex-account.json）
  const { base, suffix } = splitFileExtension(trimmed)
  if (base.length <= 8)
    return trimmed

  return `${base.slice(0, 3)}***${base.slice(-4)}${suffix}`
}
