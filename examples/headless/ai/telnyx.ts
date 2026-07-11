import * as OpenAiCompatClient from "@effect/ai-openai-compat/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai-compat/OpenAiLanguageModel"
import { Http402 } from "crosshatch"
import { Effect, Layer, pipe, Schema } from "effect"
import { Model } from "effect/unstable/ai"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

const TELNYX_API_URL = "https://x402.telnyx.com/v1"
export const DEFAULT_MODEL = "MiniMaxAI/MiniMax-M2.7"

const OpenAiClient = OpenAiCompatClient.layer({
  apiUrl: TELNYX_API_URL,
  transformClient: HttpClient.transformResponse(
    Effect.flatMap((response) =>
      pipe(
        response,
        HttpClientResponse.schemaBodyJson(Schema.Any),
        Effect.map(({ service_tier: _, ...res }) =>
          HttpClientResponse.fromWeb(response.request, new Response(JSON.stringify(res))),
        ),
        Effect.orElseSucceed(() => response),
      ),
    ),
  ),
}).pipe(Layer.provide(Http402.layerClient))

export const layer = (config: typeof OpenAiLanguageModel.Config.Service) => {
  const model = config.model ?? DEFAULT_MODEL
  return Model.make("telnyx", model, OpenAiLanguageModel.layer({ model, config }).pipe(Layer.provide(OpenAiClient)))
}
