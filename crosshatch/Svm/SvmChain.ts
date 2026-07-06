import { Config, Effect } from "effect"

import * as Chain from "../Chain.ts"
import * as Mnemonic from "../Mnemonic.ts"
import type { SvmPayloadContext } from "./SvmPayloadContext.ts"
import * as SvmPayload from "./SvmPayload.ts"
import { fromSecretKey, getSecretKey, type SvmSigner } from "./SvmSigner.ts"

export class SvmChain extends Chain.Service<SvmChain>()("crosshatch/Svm/SvmChain") {}

export const fromSigner = (signer: SvmSigner, context: SvmPayloadContext): Chain.Chain =>
  ({
    createPayload: Effect.fnUntraced(function* ({ accepted, extensions }) {
      const payload = yield* SvmPayload.make(signer, accepted, context)
      return {
        payload: {
          x402Version: 2,
          accepted,
          extensions,
          payload,
        },
      }
    }),
  }) satisfies Chain.Chain

export const fromMnemonic = (mnemonic: typeof Mnemonic.MnemonicRedacted.Type, context: SvmPayloadContext) =>
  Effect.promise(() => fromSecretKey(getSecretKey(mnemonic))).pipe(Effect.map((signer) => fromSigner(signer, context)))

export const fromMnemonicConfig = (
  mnemonicConfig: Config.Config<typeof Mnemonic.MnemonicRedacted.Type>,
  context: SvmPayloadContext,
) => mnemonicConfig.pipe(Effect.flatMap((mnemonic) => fromMnemonic(mnemonic, context)))
