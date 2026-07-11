import { Effect, Schema as S } from "effect"

import { Ed25519PrivateKey, fromBytes as privateKeyFromBytes } from "./Ed25519PrivateKey.ts"
import { Ed25519PublicKey } from "./Ed25519PublicKey.ts"

const TypeId = "crosshatch/Ed25519Pair" as const

export class Ed25519Pair extends S.Class<Ed25519Pair>("Ed25519Pair")({
  [TypeId]: S.tag(TypeId),
  privateKey: Ed25519PrivateKey,
  publicKey: Ed25519PublicKey,
}) {}

export const fromCryptoKeyPair = ({ privateKey, publicKey }: CryptoKeyPair) =>
  Ed25519Pair.make({
    privateKey: Ed25519PrivateKey.make(privateKey),
    publicKey: Ed25519PublicKey.make(publicKey),
  })

export const random = (config?: { readonly extractable?: boolean | undefined }) =>
  Effect.promise(() =>
    crypto.subtle.generateKey({ name: "Ed25519" }, config?.extractable ?? false, ["sign", "verify"]),
  ).pipe(Effect.map(fromCryptoKeyPair))

export const fromPrivateKeyBytes = (bytes: Uint8Array) =>
  Effect.all({
    publicKey: privateKeyFromBytes(bytes, { extractable: true }).pipe(
      Effect.flatMap((v) => Effect.promise(() => crypto.subtle.exportKey("jwk", v))),
      Effect.flatMap(({ x }) =>
        Effect.promise(() =>
          crypto.subtle.importKey("jwk", { crv: "Ed25519", kty: "OKP", ...(x && { x }) }, { name: "Ed25519" }, true, [
            "verify",
          ]),
        ),
      ),
      Effect.map(Ed25519PublicKey.make),
    ),
    privateKey: privateKeyFromBytes(bytes),
  }).pipe(Effect.map(Ed25519Pair.make))
