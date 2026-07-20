import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"

import { layerMnemonic } from "../Eip155/Eip155Signer.ts"
import * as Mnemonic from "../Mnemonic.ts"
import * as Challenge from "./Challenge.ts"
import { ChallengeStore, layerChallengeMemory, type StoredChallenge } from "./ChallengeStore.ts"
import { Challenge as ChallengeSchema, Info, SupportedChain } from "./Schema.ts"
import * as Siwe from "./Siwe.ts"
import { VerificationError, verifyProof } from "./Verification.ts"

const mnemonicText = "test test test test test test test test test test test junk"
const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const

const entry = {
  chainId: "eip155:1",
  type: "eip191",
  signatureScheme: "eip191",
} satisfies typeof SupportedChain.Type

const requestUrl = new URL("https://example.com/login")

const withMemory = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(
      Layer.mergeAll(
        layerChallengeMemory,
        layerMnemonic.pipe(Layer.provide(Mnemonic.layerText(mnemonicText))),
      ),
    ),
  )

const makeChallenge = (uri = requestUrl.href) =>
  Challenge.make({
    uri,
    networks: ["eip155:1"],
    verifiers: [Siwe.verifier],
  })

const createProof = (challenge: typeof ChallengeSchema.Type) => Option.getOrThrow(Siwe.prover(challenge.info, entry))

const verify = (proof: Parameters<ReturnType<typeof verifyProof>>[0], url: URL = requestUrl) =>
  verifyProof(Siwe.verifier)(proof, url)

describe(import.meta.url, () => {
  it.effect(
    "round-trips make → createProof → verifyProof",
    Effect.fn(function* () {
      const challenge = yield* makeChallenge()
      const proof = yield* createProof(challenge)
      const identity = yield* verify(proof)
      expect(identity.accountId.toLowerCase()).toBe(`eip155:1:${address}`.toLowerCase())
      expect(identity.address.toLowerCase()).toBe(address.toLowerCase())
      expect(identity.chainId).toBe("eip155:1")
    }, withMemory),
  )

  it.effect(
    "rejects a second verify of the same nonce",
    Effect.fn(function* () {
      const challenge = yield* makeChallenge()
      const proof = yield* createProof(challenge)
      yield* verify(proof)
      const error = yield* verify(proof).pipe(Effect.flip)
      expect(error).toBeInstanceOf(VerificationError)
      expect(["unknown_nonce", "nonce_consume_failed"]).toContain(error.reason)
    }, withMemory),
  )

  it.effect(
    "rejects a proof presented to a different origin",
    Effect.fn(function* () {
      const challenge = yield* makeChallenge()
      const proof = yield* createProof(challenge)
      const error = yield* verify(proof, new URL("https://evil.com/login")).pipe(Effect.flip)
      expect(error).toBeInstanceOf(VerificationError)
      expect(error.reason).toBe("uri_mismatch")
    }, withMemory),
  )

  it.effect(
    "rejects unknown nonce",
    Effect.fn(function* () {
      const challenge = yield* makeChallenge()
      const proof = yield* createProof(challenge)
      const error = yield* verify({ ...proof, nonce: "deadbeefdeadbeefdeadbeefdeadbeef" }).pipe(Effect.flip)
      expect(error).toBeInstanceOf(VerificationError)
      expect(error.reason).toBe("unknown_nonce")
    }, withMemory),
  )

  it.effect(
    "rejects when no verifier supports the proof",
    Effect.fn(function* () {
      const challenge = yield* makeChallenge()
      const proof = yield* createProof(challenge)
      const error = yield* verifyProof()(proof, requestUrl).pipe(Effect.flip)
      expect(error).toBeInstanceOf(VerificationError)
      expect(error.reason).toBe("unsupported_verifier")
    }, withMemory),
  )

  it.effect(
    "rejects info mismatch",
    Effect.fn(function* () {
      const challenge = yield* makeChallenge()
      const proof = yield* createProof(challenge)
      const error = yield* verify({ ...proof, statement: "tampered statement" }).pipe(Effect.flip)
      expect(error).toBeInstanceOf(VerificationError)
      expect(error.reason).toBe("info_mismatch")
    }, withMemory),
  )

  it.effect(
    "rejects uri mismatch when request path differs",
    Effect.fn(function* () {
      const challenge = yield* makeChallenge("https://example.com/login")
      const proof = yield* createProof(challenge)
      const error = yield* verify(proof, new URL("https://example.com/other")).pipe(Effect.flip)
      expect(error).toBeInstanceOf(VerificationError)
      expect(error.reason).toBe("uri_mismatch")
    }, withMemory),
  )

  it.effect(
    "rejects stale issuedAt as timestamp_invalid",
    Effect.fn(function* () {
      const store = yield* ChallengeStore
      const issuedAt = new Date(Date.now() - 600_000).toISOString()
      const info = {
        domain: "example.com",
        uri: "https://example.com/login",
        version: "1",
        nonce: "0123456789abcdef0123456789abcdef",
        issuedAt,
      } satisfies typeof Info.Type
      const challenge = {
        info,
        supportedChains: [entry],
        schema: {},
      } satisfies typeof ChallengeSchema.Type
      yield* store.insert({ challenge, expiresAt: Date.now() + 300_000 })
      const proof = yield* createProof(challenge)
      const error = yield* verify(proof).pipe(Effect.flip)
      expect(error).toBeInstanceOf(VerificationError)
      expect(error.reason).toBe("timestamp_invalid")
    }, withMemory),
  )

  it.effect(
    "rejects invalid signature as proof_rejected",
    Effect.fn(function* () {
      const challenge = yield* makeChallenge()
      const proof = yield* createProof(challenge)
      const error = yield* verify({
        ...proof,
        signature:
          "0x1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
      }).pipe(Effect.flip)
      expect(error).toBeInstanceOf(VerificationError)
      expect(error.reason).toBe("proof_rejected")
    }, withMemory),
  )

  it.effect(
    "rejects when nonce consume returns false",
    Effect.fn(
      function* () {
        const challenge = yield* makeChallenge().pipe(Effect.provide(layerChallengeMemory))
        const proof = yield* createProof(challenge)
        const entryStored: StoredChallenge = {
          challenge,
          expiresAt: Date.now() + 300_000,
        }
        const nonConsuming = Layer.succeed(ChallengeStore, {
          insert: () => Effect.succeed(true),
          get: (nonce) => Effect.succeed(nonce === proof.nonce ? entryStored.challenge : undefined),
          consume: () => Effect.succeed(false),
        })
        const error = yield* verify(proof).pipe(Effect.provide(nonConsuming), Effect.flip)
        expect(error).toBeInstanceOf(VerificationError)
        expect(error.reason).toBe("nonce_consume_failed")
      },
      (effect) => effect.pipe(Effect.provide(layerMnemonic.pipe(Layer.provide(Mnemonic.layerText(mnemonicText))))),
    ),
  )
})
