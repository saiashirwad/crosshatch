import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget"
import { getAddMemoInstruction } from "@solana-program/memo"
import { findAssociatedTokenPda, getTransferCheckedInstruction } from "@solana-program/token"
import { address } from "@solana/addresses"
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  partiallySignTransactionMessageWithSigners,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  pipe as solanaPipe,
} from "@solana/kit"
import { Effect, Schema as S } from "effect"

import { CreatePayloadError } from "../Adapter.ts"
import * as Adapter from "../Adapter.ts"
import * as SolanaAddress from "./SolanaAddress.ts"
import * as SolanaAsset from "./SolanaAsset.ts"
import { SolanaSigner } from "./SolanaSigner.ts"

export class SolanaAdapter extends Adapter.Service<SolanaAdapter>()("@crosshatch/SolanaAdapter") {}

export const layer = SolanaAdapter.layer(
  Effect.fnUntraced(function* ({ deployment, accepted }) {
    const { feePayer, memo } = yield* S.decodeUnknownEffect(
      S.Struct({
        feePayer: SolanaAddress.SolanaAddress,
        memo: S.String.pipe(
          S.check(
            S.makeFilter((s) => new TextEncoder().encode(s).length <= 256, {
              expected: `a string of at most 256 UTF-8 bytes`,
            }),
          ),
          S.optional,
        ),
      }),
    )(accepted.extra)
    const mintAsset = yield* S.decodeUnknownEffect(SolanaAsset.SolanaAsset)(accepted.asset)
    const { tokenProgramId } = yield* S.decodeUnknownEffect(
      S.Struct({
        tokenProgramId: SolanaAddress.SolanaAddress,
      }),
    )(deployment.metadata)

    return Effect.gen(function* () {
      const signer = yield* SolanaSigner
      const latestBlockhash = yield* signer.getLatestBlockhash(accepted.network)

      const mint = address(mintAsset)
      const owner = signer.address
      const dest = address(accepted.payTo)
      const tokenProgram = address(tokenProgramId)

      const [[sourceAta], [destAta]] = yield* Effect.all([
        Effect.promise(() => findAssociatedTokenPda({ owner, mint, tokenProgram })),
        Effect.promise(() =>
          findAssociatedTokenPda({
            owner: dest,
            mint,
            tokenProgram,
          }),
        ),
      ])

      const transactionMessage = solanaPipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayer(address(feePayer), m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        (m) =>
          appendTransactionMessageInstructions(
            [
              getSetComputeUnitLimitInstruction({ units: 100000 }),
              getSetComputeUnitPriceInstruction({ microLamports: 100000n }),
              getTransferCheckedInstruction(
                {
                  source: sourceAta,
                  mint,
                  destination: destAta,
                  authority: signer,
                  amount: BigInt(accepted.amount),
                  decimals: deployment.decimals,
                },
                { programAddress: tokenProgram },
              ),
              ...(memo === undefined ? [] : [getAddMemoInstruction({ memo })]),
            ],
            m,
          ),
      )

      const transaction = yield* Effect.tryPromise(() =>
        partiallySignTransactionMessageWithSigners(transactionMessage),
      ).pipe(Effect.map(getBase64EncodedWireTransaction))

      return { transaction }
    }).pipe(Effect.mapError((cause) => new CreatePayloadError({ cause })))
  }),
)
