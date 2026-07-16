import { Encoding } from "effect"

export const bytes = (length: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(length))

export const hex = (length: number): string => Encoding.encodeHex(bytes(length))
