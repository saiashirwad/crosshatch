import { Config, Effect } from "effect"

import * as Chain from "../Chain.ts"
import * as Mnemonic from "../Mnemonic.ts"
import * as SvmAddress from "./SvmAddress.ts"
import * as SvmPayload from "./SvmPayload.ts"
import { fromSecretKey, type SvmSigner } from "./SvmSigner.ts"

export class SvmChain extends Chain.Service<SvmChain>()("crosshatch/Svm/SvmChain") {}

export const fromSigner = (signer: SvmSigner): Chain.Chain =>
  ({
    createPayload: Effect.fnUntraced(function* ({ accepted, extensions }) {
      // No transfer-method based branching like EVM (i.e., no permit2 vs eip3009) -
      // Solana has a single SPL (Solana Program Library) transfer path
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
  fromSigner(fromSecretKey(SvmAddress.fromMnemonic(mnemonic).secretKey))

export const fromMnemonicConfig = (mnemonicConfig: Config.Config<typeof Mnemonic.MnemonicRedacted.Type>) =>
  mnemonicConfig.pipe(Effect.map(fromMnemonic))
