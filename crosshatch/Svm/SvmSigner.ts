import { Keypair, type Transaction } from "@solana/web3.js"

import type { SvmAddress } from "./SvmAddress"

export interface SvmSigner {
  readonly address: typeof SvmAddress.Encoded
  readonly signTransaction: (transaction: Transaction) => Promise<Transaction>
  // also consider doing VersionedTransaction
}

export const fromSecretKey = (secretKey: Uint8Array): SvmSigner => {
  const keypair = Keypair.fromSecretKey(secretKey)
  return {
    address: keypair.publicKey.toBase58() as typeof SvmAddress.Encoded,
    signTransaction: async (transaction) => {
      transaction.sign(keypair)
      // transaction.sign([keypair]) for VersionedTransaction
      return transaction
    },
  }
}
