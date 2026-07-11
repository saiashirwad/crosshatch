import { address as makeSolanaKitAddress } from "@solana/addresses"
import type { TransactionPartialSigner } from "@solana/kit"
import type { Blockhash } from "@solana/rpc-types"
import { partiallySignTransaction } from "@solana/transactions"
import { Context, Effect, Layer, Redacted } from "effect"
import { Mnemonic as OxMnemonic } from "ox"

import type { CreatePayloadError } from "../Adapter.ts"
import type { ChainId } from "../ChainId.ts"
import { Ed25519Pair, Slip10 } from "../Crypto/Crypto.ts"
import * as Mnemonic from "../Mnemonic.ts"
import * as SolanaAddress from "./SolanaAddress.ts"

export type GetLatestBlockhash = (network: typeof ChainId.Type) => Effect.Effect<
  {
    readonly blockhash: Blockhash
    readonly lastValidBlockHeight: bigint
  },
  CreatePayloadError
>

export class SolanaSigner extends Context.Service<
  SolanaSigner,
  TransactionPartialSigner & { readonly getLatestBlockhash: GetLatestBlockhash }
>()("crosshatch/Solana/SolanaSigner") {}

export const layerMnemonic = (getLatestBlockhash: GetLatestBlockhash) => (mnemonic: typeof Mnemonic.Mnemonic.Type) =>
  Layer.effect(
    SolanaSigner,
    Effect.gen(function* () {
      const keyPair = yield* Slip10.derive(OxMnemonic.toSeed(Redacted.value(mnemonic)), [44, 501, 0, 0]).pipe(
        Effect.flatMap(({ privateKeySeed }) => Ed25519Pair.fromBytes(privateKeySeed)),
      )
      const address = makeSolanaKitAddress(yield* SolanaAddress.fromMnemonic(mnemonic))
      const signTransactions: TransactionPartialSigner["signTransactions"] = (transactions) =>
        Promise.all(
          transactions.map(async (transaction) => {
            const { signatures } = await partiallySignTransaction([keyPair], transaction)
            return { [address]: signatures[address]! }
          }),
        )
      return { address, signTransactions, getLatestBlockhash }
    }),
  )
