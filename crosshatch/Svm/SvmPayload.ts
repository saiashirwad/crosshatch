import { createTransferInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { Connection, PublicKey, Transaction } from "@solana/web3.js"
import { Config, Effect, Schema as S, Encoding } from "effect"

import { CreatePayloadError } from "../errors.ts"
import type { Requirements } from "../Requirements.ts"
import type { SvmSigner } from "./SvmSigner.ts"

export const SvmPayload = S.Struct({
  // Solana payment payload — base64 transaction, partially signed by the payer.
  transaction: S.String,
})

export const make = Effect.fnUntraced(function* (signer: SvmSigner, requirement: typeof Requirements.Type) {
  // The Facilitator's sponsor account pays the SOL tx fee - set as feePayer so it's the first signer
  const feePayer = requirement.extra?.feePayer
  if (!feePayer) {
    return yield* new CreatePayloadError({})
  }

  // e.g. https://api.mainnet.solana.com
  // NOTE: do we just want to hard-code this?
  const rpcEndpoint = yield* Config.string("SVM_RPC_ENDPOINT").pipe(
    Effect.mapError((cause) => new CreatePayloadError({ cause })),
  )
  const connection = new Connection(rpcEndpoint)

  // on-chain account that represents a specific token
  const mint = new PublicKey(requirement.asset)
  // the wallet that owns sourceAta
  const owner = new PublicKey(signer.address)
  const dest = new PublicKey(requirement.payTo)
  const amount = BigInt(requirement.amount)

  // Each wallet's token account for this mint - deterministically derived from (mint, owner)
  const sourceAta = getAssociatedTokenAddressSync(mint, owner)
  const destAta = getAssociatedTokenAddressSync(mint, dest)

  // Solana transactions must reference a recent blockhash
  const { blockhash, lastValidBlockHeight } = yield* Effect.tryPromise({
    try: () => connection.getLatestBlockhash(),
    catch: (cause) => new CreatePayloadError({ cause }),
  })

  const transferInstruction = createTransferInstruction(sourceAta, destAta, owner, amount, [], TOKEN_PROGRAM_ID)
  const tx = new Transaction({
    // Facilitator's sponsor account pays the SOL tx fee (and must cosign before broadcast)
    feePayer: new PublicKey(feePayer),
    blockhash,
    lastValidBlockHeight,
  }).add(transferInstruction)

  yield* Effect.tryPromise({
    try: () => signer.signTransaction(tx),
    catch: (cause) => new CreatePayloadError({ cause }),
  })

  // Serialize without requiring the feePayer's signature - the facilitator adds it before broadcast
  const transaction = Encoding.encodeBase64(tx.serialize({ requireAllSignatures: false }))
  return { transaction } satisfies typeof SvmPayload.Type
})
