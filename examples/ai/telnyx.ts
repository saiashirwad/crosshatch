import * as OpenAiClient from "@effect/ai-openai-compat/OpenAiClient"
import * as OpenAiLanguageModel from "@effect/ai-openai-compat/OpenAiLanguageModel"
import { Http402 } from "crosshatch"
import { Effect, Layer, pipe, Schema } from "effect"
import { Model } from "effect/unstable/ai"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

const TELNYX_API_URL = "https://x402.telnyx.com/v1"
export const DEFAULT_MODEL = "MiniMaxAI/MiniMax-M2.7"

const TelnyxOpenAiClient = OpenAiClient.layer({
  apiUrl: TELNYX_API_URL,
  transformClient: HttpClient.transformResponse(
    Effect.flatMap((response) =>
      pipe(
        response,
        HttpClientResponse.schemaBodyJson(
          Schema.StructWithRest(Schema.Struct({ service_tier: Schema.Null }), [
            Schema.Record(Schema.String, Schema.Unknown),
          ]),
        ),
        Effect.map(({ service_tier: _, ...rest }) =>
          HttpClientResponse.fromWeb(
            response.request,
            new Response(JSON.stringify(rest), {
              status: response.status,
            }),
          ),
        ),
        Effect.catch(() => Effect.succeed(response)),
      ),
    ),
  ),
})

export const model = (config: typeof OpenAiLanguageModel.Config.Service) => {
  const modelName = config.model ?? DEFAULT_MODEL
  return Model.make(
    "telnyx",
    modelName,
    OpenAiLanguageModel.layer({ model: modelName, config }).pipe(
      Layer.provide(TelnyxOpenAiClient),
      Layer.provide(Http402.layerClient),
    ),
  )
}
