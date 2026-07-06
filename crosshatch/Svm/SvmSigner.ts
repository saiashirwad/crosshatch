import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/signers"
import { derivePath } from "ed25519-hd-key"
import { Redacted, Schema as S } from "effect"
import { Ed25519, Hex, Mnemonic as OxMnemonic } from "ox"

import type { MnemonicRedacted } from "../Mnemonic.ts"
import { SvmAddress } from "./SvmAddress.ts"

export interface SvmSigner {
  readonly address: typeof SvmAddress.Type
  readonly signer: KeyPairSigner
}

export const fromSecretKey = async (secretKey: Uint8Array): Promise<SvmSigner> => {
  const signer = await createKeyPairSignerFromBytes(secretKey)
  return {
    address: S.decodeUnknownSync(SvmAddress)(signer.address),
    signer,
  }
}

export const getSecretKey = (mnemonic: typeof MnemonicRedacted.Type) => {
  const seed = Hex.fromBytes(OxMnemonic.toSeed(Redacted.value(mnemonic)))
  const { key: privateKey } = derivePath("m/44'/501'/0'/0'", seed)
  const publicKey = Ed25519.getPublicKey({ privateKey, as: "Bytes" })
  const secretKey = new Uint8Array(64)
  secretKey.set(privateKey, 0)
  secretKey.set(publicKey, 32)
  return secretKey
}
