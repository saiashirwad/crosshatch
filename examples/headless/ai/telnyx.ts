import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai-compat"
import { Http402 } from "crosshatch"
import { Effect, Layer, Schema as S } from "effect"
import { Model } from "effect/unstable/ai"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"

import type { LanguageModelConfig } from "./types"

const OpenAiClientLive = OpenAiClient.layer({
  apiUrl: "https://x402.telnyx.com/v1",
  transformClient: HttpClient.transformResponse(
    Effect.flatMap((response) =>
      HttpClientResponse.schemaBodyJson(S.Any)(response).pipe(
        Effect.map(({ service_tier: _, ...body }) =>
          HttpClientResponse.fromWeb(response.request, Response.json(body, response)),
        ),
        Effect.orElseSucceed(() => response),
      ),
    ),
  ),
}).pipe(Layer.provide(Http402.layerClient))

export const layer = ({ model, ...config }: LanguageModelConfig) =>
  Model.make("telnyx", model, OpenAiLanguageModel.layer({ model, config }).pipe(Layer.provide(OpenAiClientLive)))
