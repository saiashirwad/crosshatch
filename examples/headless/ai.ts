import { Payer } from "crosshatch"
import { Effect, Layer } from "effect"
import { LanguageModel, Model } from "effect/unstable/ai"

import { PayerLive } from "./_common.ts"
import * as Blockrun from "./ai/blockrun.ts"
import * as Telnyx from "./ai/telnyx.ts"

const program = <T>(model: Model.Model<T, LanguageModel.LanguageModel, Payer.Payer>) =>
  LanguageModel.LanguageModel.pipe(
    Effect.flatMap((model) => model.generateText({ prompt: "Hello from crosshatch" })),
    Effect.provide(model.pipe(Layer.provide(PayerLive))),
    Effect.tap(({ text }) => Effect.log(text)),
  )

await Effect.all(
  {
    blockrun: program(Blockrun.layer({ model: "deepseek/deepseek-chat" })),
    telnyx: program(Telnyx.layer({ model: "meta-llama/Meta-Llama-3.1-8B-Instruct" })),
  },
  { concurrency: "unbounded" },
).pipe(Effect.runPromise)
