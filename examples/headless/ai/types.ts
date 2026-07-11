import type { OpenAiLanguageModel } from "@effect/ai-openai-compat"

export type LanguageModelConfig = typeof OpenAiLanguageModel.Config.Service & { readonly model: string }
