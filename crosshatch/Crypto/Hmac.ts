import { Effect } from "effect"

export type Hash = "SHA-256" | "SHA-384" | "SHA-512"

export const sign = Effect.fnUntraced(function* (key: Uint8Array, data: Uint8Array, hash: Hash) {
  const cryptoKey = yield* Effect.promise(() =>
    crypto.subtle.importKey("raw", key.slice(), { name: "HMAC", hash }, false, ["sign"]),
  )
  return yield* Effect.promise(() => crypto.subtle.sign("HMAC", cryptoKey, data.slice())).pipe(
    Effect.map((mac) => new Uint8Array(mac)),
  )
})

export const sha256 = (key: Uint8Array, data: Uint8Array) => sign(key, data, "SHA-256")

export const sha512 = (key: Uint8Array, data: Uint8Array) => sign(key, data, "SHA-512")
