import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget"
import { getAddMemoInstruction } from "@solana-program/memo"
import { findAssociatedTokenPda, getTransferCheckedInstruction } from "@solana-program/token"
import { address } from "@solana/addresses"
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit"
import { partiallySignTransactionMessageWithSigners } from "@solana/signers"
import { getBase64EncodedWireTransaction } from "@solana/transactions"
import { Effect, Schema as S } from "effect"

import { CreatePayloadError } from "../Payer.ts"
import type { Deployment } from "../PhysicalAsset.ts"
import type { Requirements } from "../Requirements.ts"
import * as SvmAddress from "./SvmAddress.ts"
import * as SvmAsset from "./SvmAsset.ts"
import type { SvmPayloadContext } from "./SvmPayloadContext.ts"
import type { SvmSigner } from "./SvmSigner.ts"

export const SvmPayload = S.Struct({
  transaction: S.String,
})

const utf8ByteLength = (s: string): number => new TextEncoder().encode(s).length

const randomNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

const SvmExtraSchema = S.Struct({
  feePayer: SvmAddress.SvmAddress,
  memo: S.optional(S.String.pipe(S.refine((s): s is string => utf8ByteLength(s) <= 256))),
})

const SvmDeploymentMetadata = S.Struct({
  tokenProgramId: SvmAddress.SvmAddress,
})

const getExtra = (input: unknown): Effect.Effect<typeof SvmExtraSchema.Type, CreatePayloadError> =>
  S.decodeUnknownEffect(SvmExtraSchema)(input).pipe(Effect.mapError((cause) => new CreatePayloadError({ cause })))

const getMintAsset = (input: unknown): Effect.Effect<typeof SvmAsset.SvmAsset.Type, CreatePayloadError> =>
  S.decodeUnknownEffect(SvmAsset.SvmAsset)(input).pipe(Effect.mapError((cause) => new CreatePayloadError({ cause })))

const getDeploymentMetadata = (input: unknown): Effect.Effect<typeof SvmDeploymentMetadata.Type, CreatePayloadError> =>
  S.decodeUnknownEffect(SvmDeploymentMetadata)(input).pipe(Effect.mapError((cause) => new CreatePayloadError({ cause })))

export const make = Effect.fnUntraced(function* (
  signer: SvmSigner,
  requirement: typeof Requirements.Type,
  deployment: Deployment,
  context: SvmPayloadContext,
) {
  const { feePayer, memo } = yield* getExtra(requirement.extra)

  const mintAsset = yield* getMintAsset(requirement.asset)

  const { tokenProgramId } = yield* getDeploymentMetadata(deployment.metadata)
  const latestBlockhash = yield* context.getLatestBlockhash(requirement.network)

  const mint = address(mintAsset)
  const owner = address(signer.address)
  const dest = address(requirement.payTo)
  const amount = BigInt(requirement.amount)
  const tokenProgram = address(tokenProgramId)

  const [[sourceAta], [destAta]] = yield* Effect.tryPromise({
    try: () =>
      Promise.all([
        findAssociatedTokenPda({ owner, mint, tokenProgram }),
        findAssociatedTokenPda({ owner: dest, mint, tokenProgram }),
      ]),
    catch: (cause) => new CreatePayloadError({ cause }),
  })

  const transferInstruction = getTransferCheckedInstruction(
    {
      source: sourceAta,
      mint,
      destination: destAta,
      authority: signer.signer,
      amount,
      decimals: deployment.decimals,
    },
    { programAddress: tokenProgram },
  )

  const memoText = memo ?? randomNonce()
  const memoInstruction = getAddMemoInstruction({ memo: memoText })

  const limitInstruction = getSetComputeUnitLimitInstruction({ units: 100_000 })
  const priceInstruction = getSetComputeUnitPriceInstruction({ microLamports: 100_000n })

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(address(feePayer), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) =>
      appendTransactionMessageInstructions(
        [limitInstruction, priceInstruction, transferInstruction, memoInstruction],
        m,
      ),
  )

  const signedTransaction = yield* Effect.tryPromise({
    try: () => partiallySignTransactionMessageWithSigners(transactionMessage),
    catch: (cause) => new CreatePayloadError({ cause }),
  })

  const transaction = getBase64EncodedWireTransaction(signedTransaction)
  return { transaction } satisfies typeof SvmPayload.Type
})
