import * as OpenAiClient from "@effect/ai-openai-compat/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai-compat/OpenAiLanguageModel"
import { Http402 } from "crosshatch"
import { Layer } from "effect"
import { Model } from "effect/unstable/ai"

const BLOCKRUN_API_URL = "https://blockrun.ai/api/v1"
export const DEFAULT_MODEL = "openai/gpt-5-nano"

export const layer = (config: typeof OpenAiLanguageModel.Config.Service) => {
  const model = config.model ?? DEFAULT_MODEL
  return Model.make(
    "blockrun",
    model,
    OpenAiLanguageModel.layer({ model, config }).pipe(
      Layer.provide(OpenAiClient.layer({ apiUrl: BLOCKRUN_API_URL })),
      Layer.provide(Http402.layerClient),
    ),
  )
}
