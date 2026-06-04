export function getLlmApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
}

export function getLlmBaseUrl(): string {
  if (process.env.LLM_BASE_URL) {
    return process.env.LLM_BASE_URL.replace(/\/$/, '')
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return 'https://api.deepseek.com/v1'
  }
  return 'https://api.openai.com/v1'
}

export function getLlmModel(): string {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek-chat'
  return 'gpt-4o-mini'
}

export function isXfyunAsrConfigured(): boolean {
  return !!(process.env.XFYUN_APP_ID && process.env.XFYUN_API_KEY && process.env.XFYUN_API_SECRET)
}

export function getAsrProvider(): 'xfyun' | 'whisper' {
  return isXfyunAsrConfigured() ? 'xfyun' : 'whisper'
}
