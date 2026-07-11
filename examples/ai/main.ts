import { Effect, Layer } from "effect"
import { LanguageModel } from "effect/unstable/ai"

import { PayerLive } from "./_common.ts"
import * as Telnyx from "./telnyx.ts"

// Effect.gen(function* () {
//   const model = yield* LanguageModel.LanguageModel
//   const response = yield* model.generateText({ prompt: "Hello from Crosshatch" })
//   yield* Effect.log(response.text)
// }).pipe(
//   Effect.provide([Blockrun.model({ model: "deepseek/deepseek-chat" }).pipe(Layer.provide(PayerLive))]),
//   Effect.runPromise,
// )

Effect.gen(function* () {
  const model = yield* LanguageModel.LanguageModel
  const response = yield* model.generateText({ prompt: "Hello from Crosshatch" })
  yield* Effect.log(response.text)
}).pipe(
  Effect.provide([Telnyx.model({ model: "meta-llama/Meta-Llama-3.1-8B-Instruct" }).pipe(Layer.provide(PayerLive))]),
  Effect.runPromise,
)
