import { Payer } from "crosshatch"
import { Effect, Layer } from "effect"
import { LanguageModel, Model } from "effect/unstable/ai"

import { PayerLive } from "./_common.ts"
import * as Blockrun from "./blockrun.ts"
import * as Telnyx from "./telnyx.ts"

const program = <T>(model: Model.Model<T, LanguageModel.LanguageModel, Payer.Payer>) =>
  Effect.gen(function* () {
    const languageModel = yield* LanguageModel.LanguageModel
    const response = yield* languageModel.generateText({ prompt: "Hello from Crosshatch" })
    yield* Effect.log(response.text)
  }).pipe(Effect.provide(model.pipe(Layer.provide(PayerLive))))

await Effect.runPromise(program(Blockrun.model({ model: "deepseek/deepseek-chat" })))
await Effect.runPromise(program(Telnyx.model({ model: "meta-llama/Meta-Llama-3.1-8B-Instruct" })))
