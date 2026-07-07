import type { Blockhash } from "@solana/rpc-types"
import type { Effect } from "effect"

import type { ChainId } from "../ChainId.ts"
import type { CreatePayloadError } from "../Payer.ts"

export interface SvmLatestBlockhash {
  readonly blockhash: Blockhash
  readonly lastValidBlockHeight: bigint
}

export interface SvmPayloadContext {
  readonly getLatestBlockhash: (network: typeof ChainId.Type) => Effect.Effect<SvmLatestBlockhash, CreatePayloadError>
}
