import * as OpenAiClient from "@effect/ai-openai-compat/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai-compat/OpenAiLanguageModel"
import { Http402 } from "crosshatch"
import { Effect, Layer, Record } from "effect"
import { Model } from "effect/unstable/ai"
import { FetchHttpClient } from "effect/unstable/http"

const TELNYX_API_URL = "https://x402.telnyx.com/v1"
export const DEFAULT_MODEL = "MiniMaxAI/MiniMax-M2.7"

const layerFetch = Layer.effect(
  FetchHttpClient.Fetch,
  Effect.map(FetchHttpClient.Fetch, (fetch) => async (input, init) => {
    const response = await fetch(input, init)
    if (!response.ok) return response

    const body = await response.clone().json()
    if (!("service_tier" in body) || body.service_tier !== null) return response

    return new Response(JSON.stringify(Record.remove(body, "service_tier")), {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(
        [...response.headers].filter(([name]) => name !== "content-length" && name !== "content-encoding"),
      ),
    })
  }),
)

export const model = (config: typeof OpenAiLanguageModel.Config.Service) => {
  const modelName = config.model ?? DEFAULT_MODEL
  return Model.make(
    "telnyx",
    modelName,
    OpenAiLanguageModel.layer({ model: modelName, config }).pipe(
      Layer.provide(OpenAiClient.layer({ apiUrl: TELNYX_API_URL })),
      Layer.provide(Http402.layerClient.pipe(Layer.provide(layerFetch))),
    ),
  )
}
