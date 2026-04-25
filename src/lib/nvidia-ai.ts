// ===== NVIDIA NIM API Client (OpenAI-compatible) =====
// Uses NVIDIA's OpenAI-compatible API endpoint for chat completions

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'

// Fallback models if the primary one fails
const FALLBACK_MODELS = [
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'qwen/qwen2.5-72b-instruct',
]

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionOptions {
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
  model?: string
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string
      role: string
    }
    finish_reason: string
    index: number
  }[]
  id: string
  model: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

function getApiKey(): string {
  const key = process.env.NVIDIA_API_KEY
  if (!key) {
    throw new Error('NVIDIA_API_KEY environment variable is not set')
  }
  return key
}

async function callNvidiaAPI(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
  const apiKey = getApiKey()
  const model = options.model || DEFAULT_MODEL

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    console.error(`NVIDIA API error (${response.status}):`, errorText)
    throw new Error(`NVIDIA API returned ${response.status}: ${errorText.slice(0, 200)}`)
  }

  const data = await response.json() as ChatCompletionResponse
  return data
}

/**
 * Create a chat completion using NVIDIA's API.
 * Automatically falls back to alternative models if the primary model fails.
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const modelsToTry = [options.model || DEFAULT_MODEL, ...FALLBACK_MODELS]
  let lastError: unknown = null

  for (const model of modelsToTry) {
    try {
      return await callNvidiaAPI({ ...options, model })
    } catch (err) {
      lastError = err
      console.warn(`NVIDIA model ${model} failed, trying next...`, err)
    }
  }

  throw lastError
}

/**
 * Simple chat completion that returns just the content string.
 */
export async function chat(
  messages: ChatMessage[],
  options?: { temperature?: number; max_tokens?: number; model?: string }
): Promise<string> {
  const response = await createChatCompletion({
    messages,
    ...options,
  })
  return response.choices[0]?.message?.content || ''
}

export { DEFAULT_MODEL, NVIDIA_BASE_URL }
export type { ChatMessage, ChatCompletionOptions, ChatCompletionResponse }
