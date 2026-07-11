import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai-compat"
import { Http402 } from "crosshatch"
import { Layer } from "effect"
import { Model } from "effect/unstable/ai"

export const layer = ({ model, ...config }: typeof OpenAiLanguageModel.Config.Service & { readonly model: string }) =>
  Model.make(
    "blockrun",
    model,
    OpenAiLanguageModel.layer({ model, config }).pipe(
      Layer.provide(OpenAiClient.layer({ apiUrl: "https://blockrun.ai/api/v1" })),
      Layer.provide(Http402.layerClient),
    ),
  )
