import { Keypair } from "@solana/web3.js"
import { derivePath } from "ed25519-hd-key"
import { Config, flow, Redacted, Schema as S } from "effect"
import { Ed25519, Hex, Mnemonic as OxMnemonic } from "ox"

import type { MnemonicRedacted } from "../Mnemonic.ts"

// Base58 encoded 32-byte Ed25519
export const SvmAddress = S.String.check(S.isPattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)).pipe(
  S.brand("crosshatch/Address"),
  S.brand("crosshatch/SvmAddress"),
)

export const config = flow(Config.string, Config.map(S.decodeUnknownSync(SvmAddress)))

export const fromMnemonic = (mnemonic: typeof MnemonicRedacted.Type) => {
  const seed = Hex.fromBytes(OxMnemonic.toSeed(Redacted.value(mnemonic)))
  const { key: privateKey } = derivePath("m/44'/501'/0'/0'", seed)
  const publicKey = Ed25519.getPublicKey({ privateKey, as: "Bytes" })
  // web3.js Keypair wants a 64-byte blob: 32 byte private key and 32 byte public key
  const secretKey = new Uint8Array(64)
  secretKey.set(privateKey, 0)
  secretKey.set(publicKey, 32)
  const keypair = Keypair.fromSecretKey(secretKey)
  return { address: SvmAddress.make(keypair.publicKey.toBase58()), secretKey }
}
