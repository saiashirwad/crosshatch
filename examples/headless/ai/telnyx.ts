import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai-compat"
import { Http402 } from "crosshatch"
import { Effect, Layer, Schema as S } from "effect"
import { Model } from "effect/unstable/ai"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"

const OpenAiClientLive = OpenAiClient.layer({
  apiUrl: "https://x402.telnyx.com/v1",
  transformClient: HttpClient.transformResponse(
    Effect.flatMap((response) =>
      HttpClientResponse.schemaBodyJson(S.Any)(response).pipe(
        Effect.map(({ service_tier: _, ...body }) => HttpClientResponse.fromWeb(response.request, Response.json(body))),
        Effect.orElseSucceed(() => response),
      ),
    ),
  ),
}).pipe(Layer.provide(Http402.layerClient))

export const layer = ({ model, ...config }: typeof OpenAiLanguageModel.Config.Service & { readonly model: string }) =>
  Model.make("telnyx", model, OpenAiLanguageModel.layer({ model, config }).pipe(Layer.provide(OpenAiClientLive)))
