import { describe, expect, it } from "@effect/vitest"
import { Effect, Encoding } from "effect"

import * as Slip10 from "./Slip10.ts"

const seed = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])

describe(import.meta.url, () => {
  it.effect(
    "derives the master private key",
    Effect.fn(function* () {
      const { privateKey } = yield* Slip10.derive(seed, [])
      expect(Encoding.encodeHex(privateKey)).toBe("2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7")
    }),
  )

  it.effect(
    "derives the m/0' child key",
    Effect.fn(function* () {
      const { privateKey } = yield* Slip10.derive(seed, [0])
      expect(Encoding.encodeHex(privateKey)).toBe("68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3")
    }),
  )

  it.effect(
    "derives the Solana path",
    Effect.fn(function* () {
      const { privateKey } = yield* Slip10.derive(seed, [44, 501, 0, 0])
      expect(Encoding.encodeHex(privateKey)).toBe("f1f890d181d1bc1fdfdb9e1911e59285b9f8a28c5c31c13e56747e6993bfa053")
    }),
  )

  it.effect(
    "matches the official SLIP-0010 ed25519 vectors",
    Effect.fn(function* () {
      const { privateKey: vector1 } = yield* Slip10.derive(seed, [0, 1, 2, 2, 1000000000])
      expect(Encoding.encodeHex(vector1)).toBe("8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793")
      const { privateKey: vector2 } = yield* Encoding.decodeHex(
        "fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542",
      ).pipe(
        Effect.fromResult,
        Effect.flatMap((v) => Slip10.derive(v, [0, 2147483647, 1, 2147483646, 2])),
      )
      expect(Encoding.encodeHex(vector2)).toBe("551d333177df541ad876a60ea71f00447931c0a9da16f227c11ea080d7391b8d")
    }),
  )
})
