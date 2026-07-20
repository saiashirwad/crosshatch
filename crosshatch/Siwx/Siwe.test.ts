import { describe, expect, it } from "@effect/vitest"
import { SiweMessage } from "@signinwithethereum/siwe"
import { Effect, Layer, Option } from "effect"
import { isHex, verifyMessage } from "viem"

import { layerMnemonic } from "../Eip155/Eip155Signer.ts"
import * as Mnemonic from "../Mnemonic.ts"
import { Challenge, Info, SupportedChain } from "./Schema.ts"
import { prover } from "./Siwe.ts"

const mnemonicText = "test test test test test test test test test test test junk"
const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const

const entry = {
  chainId: "eip155:1",
  type: "eip191",
  signatureScheme: "eip191",
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

interface Overrides {
  readonly domain?: string
  readonly requestId?: string
  readonly issuedAt?: string
  readonly expirationTime?: string
  readonly notBefore?: string
}

const challenge = (overrides: Overrides = {}) =>
  ({
    info: { ...info, ...overrides },
    supportedChains: [entry],
    schema: {},
  }) satisfies typeof Challenge.Type

const provideSigner = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provide(layerMnemonic.pipe(Layer.provide(Mnemonic.layerText(mnemonicText)))))

const createProof = (value: typeof Challenge.Type) => Option.getOrThrow(prover(value.info, entry)).pipe(provideSigner)

const referenceMessage = (overrides: Overrides = {}) =>
  new SiweMessage({
    ...info,
    ...overrides,
    address,
    chainId: 1,
  }).prepareMessage()

describe(import.meta.url, () => {
  it.effect(
    "matches the reference implementation for a canonical message",
    Effect.fn(function* () {
      const proof = yield* createProof(challenge())
      const signature = yield* Effect.succeed(proof.signature).pipe(Effect.filterOrFail(isHex))
      const verified = yield* Effect.promise(() =>
        verifyMessage({ address, message: referenceMessage(), signature }),
      )
      expect(verified).toBeTruthy()
    }),
  )

  it.effect(
    "rejects request IDs outside the EIP-4361 pchar grammar",
    Effect.fn(function* () {
      yield* createProof(challenge({ requestId: "has space" })).pipe(Effect.flip)
    }),
  )

  it.effect(
    "accepts RFC 3986 IPv6 authorities",
    Effect.fn(function* () {
      yield* createProof(challenge({ domain: "[::1]" }))
    }),
  )

  it.effect(
    "rejects timestamps that are not RFC 3339",
    Effect.fn(function* () {
      yield* createProof(challenge({ issuedAt: "2026-07-18" })).pipe(Effect.flip)
      yield* createProof(challenge({ expirationTime: "2026-07-18" })).pipe(Effect.flip)
      yield* createProof(challenge({ notBefore: "2026-07-18" })).pipe(Effect.flip)
    }),
  )
})
