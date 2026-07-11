import * as OpenAiClient from "@effect/ai-openai-compat/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai-compat/OpenAiLanguageModel"
import { Http402 } from "crosshatch"
import { Layer } from "effect"
import { Model } from "effect/unstable/ai"

const TELNYX_API_URL = "https://x402.telnyx.com/v1"
export const DEFAULT_MODEL = "MiniMaxAI/MiniMax-M2.7"

export const model = (config: typeof OpenAiLanguageModel.Config.Service) => {
  const modelName = config.model ?? DEFAULT_MODEL
  return Model.make(
    "telnyx",
    modelName,
    OpenAiLanguageModel.layer({ model: modelName, config }).pipe(
      Layer.provide(OpenAiClient.layer({ apiUrl: TELNYX_API_URL })),
      Layer.provide(Http402.layerClient),
    ),
  )
}
