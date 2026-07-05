import { Config, Effect } from "effect"

import * as Chain from "../Chain.ts"
import * as Mnemonic from "../Mnemonic.ts"
import * as SvmPayload from "./SvmPayload.ts"
import { fromSecretKey, getSecretKey, type SvmSigner } from "./SvmSigner.ts"

export class SvmChain extends Chain.Service<SvmChain>()("crosshatch/Svm/SvmChain") {}

export const fromSigner = (signer: SvmSigner): Chain.Chain =>
  ({
    createPayload: Effect.fnUntraced(function* ({ accepted, extensions }) {
      const payload = yield* SvmPayload.make(signer, accepted)
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

export const fromMnemonic = (mnemonic: typeof Mnemonic.MnemonicRedacted.Type) =>
  Effect.promise(() => fromSecretKey(getSecretKey(mnemonic))).pipe(Effect.map(fromSigner))

export const fromMnemonicConfig = (mnemonicConfig: Config.Config<typeof Mnemonic.MnemonicRedacted.Type>) =>
  mnemonicConfig.pipe(Effect.flatMap(fromMnemonic))
