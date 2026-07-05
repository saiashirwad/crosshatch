import { Keypair, type VersionedTransaction } from "@solana/web3.js"

import type { SvmAddress } from "./SvmAddress"

export interface SvmSigner {
  readonly address: typeof SvmAddress.Encoded
  readonly signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>
}

export const fromSecretKey = (secretKey: Uint8Array): SvmSigner => {
  const keypair = Keypair.fromSecretKey(secretKey)
  return {
    address: keypair.publicKey.toBase58(),
    signTransaction: async (transaction) => {
      transaction.sign([keypair])
      return transaction
    },
  }
}
