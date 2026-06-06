function sanitizeEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/^["']+|["';]+$/g, '')
}

export function getLlmApiKey(): string | undefined {
  return sanitizeEnvValue(process.env.DEEPSEEK_API_KEY) || sanitizeEnvValue(process.env.OPENAI_API_KEY)
}

export function getLlmBaseUrl(): string {
  const baseUrl = sanitizeEnvValue(process.env.LLM_BASE_URL)
  if (baseUrl) {
    return baseUrl.replace(/\/$/, '')
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return 'https://api.deepseek.com/v1'
  }
  return 'https://api.openai.com/v1'
}

export function getLlmModel(): string {
  const model = sanitizeEnvValue(process.env.LLM_MODEL)
  if (model) return model
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek-chat'
  return 'gpt-4o-mini'
}

export function isXfyunAsrConfigured(): boolean {
  return !!(process.env.XFYUN_APP_ID && process.env.XFYUN_API_KEY && process.env.XFYUN_API_SECRET)
}

export function getAsrProvider(): 'xfyun' | 'whisper' {
  return isXfyunAsrConfigured() ? 'xfyun' : 'whisper'
}
