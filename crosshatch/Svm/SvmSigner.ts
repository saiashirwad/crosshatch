import { address as SolanaAddress } from "@solana/addresses"
import type { TransactionPartialSigner } from "@solana/kit"
import type { Blockhash } from "@solana/rpc-types"
import { partiallySignTransaction } from "@solana/transactions"
import { Context, Effect, Layer, Redacted, flow } from "effect"
import { Base58, Mnemonic as OxMnemonic } from "ox"

import type { CreatePayloadError } from "../Adapter.ts"
import type { ChainId } from "../ChainId.ts"
import { CryptoKey, Ed25519Pair, Slip10 } from "../Crypto/Crypto.ts"
import * as Mnemonic from "../Mnemonic.ts"

type GetLatestBlockhash = (network: typeof ChainId.Type) => Effect.Effect<
  {
    readonly blockhash: Blockhash
    readonly lastValidBlockHeight: bigint
  },
  CreatePayloadError
>

export class SvmSigner extends Context.Service<
  SvmSigner,
  TransactionPartialSigner & { readonly getLatestBlockhash: GetLatestBlockhash }
>()("crosshatch/Svm/SvmSigner") {}

export const layerMnemonic = (getLatestBlockhash: GetLatestBlockhash) => (mnemonic: typeof Mnemonic.Mnemonic.Type) =>
  Layer.effect(
    SvmSigner,
    Effect.gen(function* () {
      const keyPair = yield* Slip10.derive(OxMnemonic.toSeed(Redacted.value(mnemonic)), [44, 501, 0, 0]).pipe(
        Effect.flatMap(({ privateKey }) => Ed25519Pair.fromPrivateKeyBytes(privateKey)),
      )
      const address = yield* CryptoKey.toBytes(keyPair.publicKey).pipe(
        Effect.map(flow(Base58.fromBytes, SolanaAddress)),
      )
      const signTransactions: TransactionPartialSigner["signTransactions"] = (transactions) =>
        Promise.all(
          transactions.map(async (transaction) => {
            const { signatures } = await partiallySignTransaction([keyPair], transaction)
            return Object.freeze({ [address]: signatures[address]! })
          }),
        )
      return { address, signTransactions, getLatestBlockhash }
    }),
  )
