import { Effect, Schema as S } from "effect"

import * as Hmac from "./Hmac.ts"

const HARDENED = 0x80000000
const MAX_NON_HARDENED_INDEX = HARDENED - 1
const CURVE = new TextEncoder().encode("ed25519 seed")

interface Slip10Node {
  readonly privateKey: Uint8Array
  readonly chainCode: Uint8Array
}

const toNode = (digest: Uint8Array): Slip10Node => ({
  privateKey: digest.slice(0, 32),
  chainCode: digest.slice(32),
})

const child = Effect.fnUntraced(function* (node: Slip10Node, index: number) {
  const data = new Uint8Array(37)
  data[0] = 0
  data.set(node.privateKey, 1)
  new DataView(data.buffer).setUint32(33, index + HARDENED, false)
  return yield* Hmac.sha512(node.chainCode, data).pipe(Effect.map(toNode))
})

export const derive = Effect.fnUntraced(function* (seed: Uint8Array, path: ReadonlyArray<number>) {
  for (const index of path) {
    yield* S.decodeEffect(S.toType(S.Int.check(S.isBetween({ minimum: 0, maximum: MAX_NON_HARDENED_INDEX }))))(index)
  }
  let node = yield* Hmac.sha512(CURVE, seed.slice()).pipe(Effect.map(toNode))
  for (const index of path) {
    node = yield* child(node, index)
  }
  return node
})
