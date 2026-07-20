import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { Base58 } from "ox"

import { Ed25519PublicKey } from "../Crypto/Crypto.ts"
import * as Mnemonic from "../Mnemonic.ts"
import { Challenge, Info, SupportedChain } from "./Schema.ts"
import { layerMnemonic, prover, verifier } from "./Siws.ts"

const layer = layerMnemonic.pipe(
  Layer.provide(Mnemonic.layerText("test test test test test test test test test test test junk")),
)

const entry = {
  chainId: "solana:mainnet",
  type: "ed25519",
  signatureScheme: "siws",
} satisfies typeof SupportedChain.Type

const info = {
  domain: "example.com",
  uri: "https://example.com/login",
  statement: "Sign in to Crosshatch",
  version: "1",
  nonce: "32891756",
  issuedAt: "2026-07-18T12:00:00.000Z",
  expirationTime: "2026-07-18T12:05:00.000Z",
  notBefore: "2026-07-18T11:59:00.000Z",
  requestId: "request-1",
  resources: ["https://example.com/resource"],
} satisfies typeof Info.Type

const minimal = {
  domain: "example.com",
  uri: "https://example.com/login",
  version: "1",
  nonce: "32891756",
  issuedAt: "2026-07-18T12:00:00.000Z",
} satisfies typeof Info.Type

const challenge = (value: typeof Info.Type) =>
  ({
    info: value,
    supportedChains: [entry],
    schema: {},
  }) satisfies typeof Challenge.Type

const createProof = (value: typeof Challenge.Type) =>
  Option.getOrThrow(prover(value.info, entry)).pipe(Effect.provide(layer))

const verifySignature = (proof: { readonly address: string; readonly signature: string }, message: string) =>
  Ed25519PublicKey.fromBytes(Base58.toBytes(proof.address)).pipe(
    Effect.flatMap((publicKey) =>
      Ed25519PublicKey.verify(publicKey, Base58.toBytes(proof.signature), new TextEncoder().encode(message)),
    ),
  )

describe(import.meta.url, () => {
  it.effect(
    "signs the canonical ABNF message for a fully populated challenge",
    Effect.fn(function* () {
      const proof = yield* createProof(challenge(info))
      const expected = [
        "example.com wants you to sign in with your Solana account:",
        proof.address,
        "",
        "Sign in to Crosshatch",
        "",
        "URI: https://example.com/login",
        "Version: 1",
        "Chain ID: mainnet",
        "Nonce: 32891756",
        "Issued At: 2026-07-18T12:00:00.000Z",
        "Expiration Time: 2026-07-18T12:05:00.000Z",
        "Not Before: 2026-07-18T11:59:00.000Z",
        "Request ID: request-1",
        "Resources:",
        "- https://example.com/resource",
      ].join("\n")
      expect(yield* verifySignature(proof, expected)).toBeTruthy()
    }),
  )

  it.effect(
    "signs the canonical ABNF message for a minimal challenge",
    Effect.fn(function* () {
      const proof = yield* createProof(challenge(minimal))
      const expected = [
        "example.com wants you to sign in with your Solana account:",
        proof.address,
        "",
        "URI: https://example.com/login",
        "Version: 1",
        "Chain ID: mainnet",
        "Nonce: 32891756",
        "Issued At: 2026-07-18T12:00:00.000Z",
      ].join("\n")
      expect(yield* verifySignature(proof, expected)).toBeTruthy()
    }),
  )

  it.effect(
    "round-trips a proof through verify",
    Effect.fn(function* () {
      const proof = yield* createProof(challenge(info))
      const identity = yield* verifier.verify(proof)
      expect(identity.accountId).toBe(`solana:mainnet:${proof.address}`)
      expect(identity.address).toBe(proof.address)
      expect(identity.chainId).toBe("solana:mainnet")
    }),
  )

  it.effect(
    "rejects proofs whose message no longer matches the signature",
    Effect.fn(function* () {
      const proof = yield* createProof(challenge(info))
      return yield* verifier.verify({ ...proof, statement: "Changed statement" }).pipe(Effect.flip)
    }),
  )

  it.effect(
    "accepts RFC 3986 IPv6 authorities",
    Effect.fn(function* () {
      yield* createProof(challenge({ ...minimal, domain: "[::1]" }))
    }),
  )

  it.effect(
    "rejects malformed challenge fields",
    Effect.fn(function* () {
      yield* createProof(challenge({ ...info, domain: "example.com/path" })).pipe(Effect.flip)
      yield* createProof(challenge({ ...info, statement: "line1\nline2" })).pipe(Effect.flip)
      yield* createProof(challenge({ ...info, nonce: "short" })).pipe(Effect.flip)
      yield* createProof(challenge({ ...info, issuedAt: "2026-07-18" })).pipe(Effect.flip)
      yield* createProof(challenge({ ...info, expirationTime: "2026-07-18" })).pipe(Effect.flip)
      yield* createProof(challenge({ ...info, notBefore: "2026-07-18" })).pipe(Effect.flip)
      yield* createProof(challenge({ ...info, requestId: "has space" })).pipe(Effect.flip)
      yield* createProof(challenge({ ...info, resources: ["not a url"] })).pipe(Effect.flip)
    }),
  )
})
