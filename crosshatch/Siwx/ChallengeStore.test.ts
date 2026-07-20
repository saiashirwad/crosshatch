import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema as S } from "effect"

import { StoredChallengeFromJson, type StoredChallenge } from "./ChallengeStore.ts"
import { Challenge, Info, SupportedChain } from "./Schema.ts"

const info = {
  domain: "example.com",
  uri: "https://example.com/login",
  version: "1",
  nonce: "0123456789abcdef0123456789abcdef",
  issuedAt: "2026-07-18T12:00:00.000Z",
} satisfies typeof Info.Type

const entry = {
  chainId: "eip155:1",
  type: "eip191",
  signatureScheme: "eip191",
} satisfies typeof SupportedChain.Type

const stored = {
  challenge: {
    info,
    supportedChains: [entry],
    schema: {},
  } satisfies typeof Challenge.Type,
  expiresAt: 1_784_375_200_000,
} satisfies StoredChallenge

describe(import.meta.url, () => {
  it.effect(
    "round-trips StoredChallenge through StoredChallengeFromJson",
    Effect.fn(function* () {
      const encoded = yield* S.encodeEffect(StoredChallengeFromJson)(stored)
      const decoded = yield* S.decodeUnknownEffect(StoredChallengeFromJson)(encoded)
      expect(decoded.challenge).toStrictEqual(stored.challenge)
      expect(decoded.expiresAt).toBe(stored.expiresAt)
    }),
  )
})
