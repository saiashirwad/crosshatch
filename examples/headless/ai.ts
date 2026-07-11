import { Effect } from "effect"
import { LanguageModel } from "effect/unstable/ai"

import { PayerLive } from "./_common.ts"
import * as Blockrun from "./ai/blockrun.ts"
import * as Telnyx from "./ai/telnyx.ts"

const generate = (prompt: string) =>
  LanguageModel.generateText({ prompt }).pipe(Effect.tap(({ text }) => Effect.log(text)))

const greeting = generate("hi from crosshatch")

await Effect.all([
  greeting.pipe(Effect.provide(Blockrun.layer({ model: "deepseek/deepseek-chat" }))),
  greeting.pipe(Effect.provide(Telnyx.layer({ model: "meta-llama/Meta-Llama-3.1-8B-Instruct" }))),
]).pipe(Effect.provide(PayerLive), Effect.runPromise)
