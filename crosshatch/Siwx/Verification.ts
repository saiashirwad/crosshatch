import { Data, DateTime, Effect, Schema as S } from "effect"

import { ChallengeStore } from "./ChallengeStore.ts"
import type { AuthenticatedIdentity } from "./Identity.ts"
import { CHALLENGE_MAX_AGE_MS, Info, type Proof } from "./Schema.ts"
import type { Verifier } from "./Verifier.ts"

export type RejectionReason =
  | "unknown_nonce"
  | "unsupported_verifier"
  | "info_mismatch"
  | "uri_mismatch"
  | "timestamp_invalid"
  | "proof_rejected"
  | "nonce_consume_failed"
  | "decode_failed"

export class VerificationError extends Data.TaggedError("VerificationError")<{
  readonly reason: RejectionReason
  readonly cause?: unknown
}> {}

const Timestamps = S.Struct({
  issuedAt: S.DateTimeUtcFromString,
  expirationTime: S.DateTimeUtcFromString.pipe(S.optional),
  notBefore: S.DateTimeUtcFromString.pipe(S.optional),
})

const reject = (reason: RejectionReason, cause?: unknown) => new VerificationError({ reason, cause })

export const verifyProof = <const Verifiers extends ReadonlyArray<Verifier.Any>>(
  ...verifiers: Verifiers
): ((
  proof: typeof Proof.Type,
  requestUrl: URL,
) => Effect.Effect<AuthenticatedIdentity, VerificationError, ChallengeStore | Verifier.Context<Verifiers[number]>>) =>
  Effect.fnUntraced(function* (proof: typeof Proof.Type, requestUrl: URL) {
    const store = yield* ChallengeStore
    const challenge = yield* store.get(proof.nonce).pipe(Effect.mapError((cause) => reject("unknown_nonce", cause)))
    if (challenge === undefined) {
      return yield* reject("unknown_nonce")
    }

    const info = yield* S.decodeUnknownEffect(Info)(proof).pipe(
      Effect.mapError((cause) => reject("info_mismatch", cause)),
    )
    if (!S.toEquivalence(Info)(info, challenge.info)) {
      return yield* reject("info_mismatch")
    }

    const uri = yield* S.decodeUnknownEffect(S.URLFromString)(challenge.info.uri).pipe(
      Effect.mapError((cause) => reject("uri_mismatch", cause)),
    )
    if (uri.href !== requestUrl.href) {
      return yield* reject("uri_mismatch")
    }

    const { issuedAt, expirationTime, notBefore } = yield* S.decodeUnknownEffect(Timestamps)(proof).pipe(
      Effect.mapError((cause) => reject("timestamp_invalid", cause)),
    )
    const now = yield* DateTime.now
    const timely =
      DateTime.between(issuedAt, {
        minimum: DateTime.subtractDuration(now, CHALLENGE_MAX_AGE_MS),
        maximum: now,
      }) &&
      (expirationTime === undefined || DateTime.isLessThan(now, expirationTime)) &&
      (notBefore === undefined || DateTime.isGreaterThanOrEqualTo(now, notBefore))
    if (!timely) {
      return yield* reject("timestamp_invalid")
    }

    const offered = challenge.supportedChains.some(
      (entry) => entry.chainId === proof.chainId && entry.type === proof.type,
    )
    const verifier = verifiers.find(
      (candidate) => candidate.type === proof.type && candidate.supportsChainId(proof.chainId),
    )
    if (!offered || verifier === undefined) {
      return yield* reject("unsupported_verifier")
    }

    const identity = yield* verifier.verify(proof).pipe(Effect.mapError((cause) => reject("proof_rejected", cause)))

    const consumed = yield* store
      .consume(proof.nonce)
      .pipe(Effect.mapError((cause) => reject("nonce_consume_failed", cause)))
    if (!consumed) {
      return yield* reject("nonce_consume_failed")
    }

    return identity
  })
