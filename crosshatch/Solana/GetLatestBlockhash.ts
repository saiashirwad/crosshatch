import { type Blockhash, createSolanaRpc } from "@solana/kit"
import { Effect, Context, Data, Layer } from "effect"

export class GetLatestBlockhashError extends Data.TaggedError("GetLatestBlockhashError")<{}> {}

export class GetLatestBlockhash extends Context.Service<
  GetLatestBlockhash,
  Effect.Effect<
    {
      readonly blockhash: Blockhash
      readonly lastValidBlockHeight: bigint
    },
    GetLatestBlockhashError
  >
>()("crosshatch/Solana/GetLatestBlockhash") {}

export const layer = (url: string) =>
  Layer.effect(
    GetLatestBlockhash,
    Effect.sync(() => {
      const rpc = createSolanaRpc(url)
      return Effect.promise((abortSignal) => rpc.getLatestBlockhash().send({ abortSignal })).pipe(
        Effect.map(({ value }) => value),
      )
    }),
  )
