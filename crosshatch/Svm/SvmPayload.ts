import { createTransferCheckedInstruction, getAssociatedTokenAddressSync, MintLayout } from "@solana/spl-token"
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js"
import { Config, Effect, Encoding, Schema as S } from "effect"
import * as Boundary from "liminal-util/Boundary"

import { CreatePayloadError } from "../errors.ts"
import type { Requirements } from "../Requirements.ts"
import * as SvmAddress from "./SvmAddress.ts"
import type { SvmSigner } from "./SvmSigner.ts"

export const SvmPayload = S.Struct({
  // Solana payment payload — base64 transaction, partially signed by the payer.
  transaction: S.String,
})

const SvmExtraSchema = S.Struct({
  feePayer: SvmAddress.SvmAddress,
})

const getFeePayer = (data: unknown) =>
  S.decodeUnknownEffect(SvmExtraSchema)(data).pipe(
    Effect.map(({ feePayer }) => feePayer),
    Effect.mapError((cause) => new CreatePayloadError({ cause })),
  )

const RpcParsedMintSchema = S.Struct({
  type: S.Literal("mint"),
  info: S.Struct({
    decimals: S.Number,
  }),
})

const fetchMintDetails = Effect.fnUntraced(
  function* (connection: Connection, mint: PublicKey) {
    const mintInfo = yield* Effect.tryPromise({
      try: () => connection.getParsedAccountInfo(mint),
      catch: (cause) => new CreatePayloadError({ cause }),
    })

    if (!mintInfo.value) {
      return yield* new CreatePayloadError({ cause: "Mint not found" })
    }

    const accountData = mintInfo.value.data
    let decimals: number

    if ("parsed" in accountData) {
      decimals = yield* S.decodeUnknownEffect(RpcParsedMintSchema)(accountData.parsed).pipe(
        Effect.map(({ info }) => info.decimals),
        Effect.mapError((cause) => new CreatePayloadError({ cause })),
      )
    } else {
      decimals = yield* Effect.try({
        try: () => MintLayout.decode(accountData).decimals,
        catch: (cause) => new CreatePayloadError({ cause }),
      })
    }

    return {
      decimals,
      programId: mintInfo.value.owner,
    }
  },
  Boundary.span("fetchMintDetails", import.meta.url),
)

export const make = Effect.fnUntraced(function* (signer: SvmSigner, requirement: typeof Requirements.Type) {
  // The Sponsor's (feePayer) address provided by the Facilitator to cover SOL network fees
  const feePayer = yield* getFeePayer(requirement.extra)

  // Public Solana RPC endpoints can be severely ratelimited
  // NOTE: we might need to support an array of RPC URLs to load balance between
  const rpcEndpoint = yield* Config.string("SVM_RPC_ENDPOINT").pipe(
    Config.withDefault("https://api.mainnet.solana.com"),
    Effect.mapError((cause) => new CreatePayloadError({ cause })),
  )
  const connection = new Connection(rpcEndpoint)

  // on-chain account that represents a specific token
  const mint = new PublicKey(requirement.asset)

  const {
    decimals,
    // Specifies if the transfer should route to either SPL or Token-2022
    programId: tokenProgramId,
  } = yield* fetchMintDetails(connection, mint)

  const owner = new PublicKey(signer.address)
  const dest = new PublicKey(requirement.payTo)
  const amount = BigInt(requirement.amount)

  // Each wallet's token account for this mint - deterministically derived from (mint, owner)
  const sourceAta = getAssociatedTokenAddressSync(mint, owner, false, tokenProgramId)
  const destAta = getAssociatedTokenAddressSync(mint, dest, false, tokenProgramId)

  // Every transaction on Solana must reference a recent blockhash
  const { blockhash } = yield* Effect.tryPromise({
    try: () => connection.getLatestBlockhash(),
    catch: (cause) => new CreatePayloadError({ cause }),
  })

  const transferInstruction = createTransferCheckedInstruction(
    sourceAta,
    mint,
    destAta,
    owner,
    amount,
    decimals,
    [],
    tokenProgramId,
  )
  const messageV0 = new TransactionMessage({
    payerKey: new PublicKey(feePayer),
    recentBlockhash: blockhash,
    instructions: [transferInstruction],
  }).compileToV0Message()

  const tx = new VersionedTransaction(messageV0)

  yield* Effect.tryPromise({
    try: () => signer.signTransaction(tx),
    catch: (cause) => new CreatePayloadError({ cause }),
  })

  // serialize the partially signed transaction to base64
  // the facilitator will provide the final signature before broadcasting to the network
  const transaction = Encoding.encodeBase64(tx.serialize())
  return { transaction } satisfies typeof SvmPayload.Type
})
