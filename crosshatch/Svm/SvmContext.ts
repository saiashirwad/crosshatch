import type { Blockhash } from "@solana/rpc-types"
import type { Effect } from "effect"

import type { ChainId } from "../ChainId.ts"
import type { CreatePayloadError } from "../errors.ts"
import type { Requirements } from "../Requirements.ts"
import * as SvmAddress from "./SvmAddress.ts"

export interface SvmLatestBlockhash {
  readonly blockhash: Blockhash
  readonly lastValidBlockHeight: bigint
}

export interface SvmAssetMetadata {
  readonly decimals: number
  readonly tokenProgramId: typeof SvmAddress.SvmAddress.Type
}

export interface SvmPayloadContext {
  readonly getLatestBlockhash: (network: typeof ChainId.Type) => Effect.Effect<SvmLatestBlockhash, CreatePayloadError>

  readonly getAssetMetadata: (
    requirement: typeof Requirements.Type,
  ) => Effect.Effect<SvmAssetMetadata, CreatePayloadError>
}
