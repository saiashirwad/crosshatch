import { Accept, KnownAssets, Mnemonic, Payer } from "crosshatch"
import { Eip155Signer, Erc3009, Permit2 } from "crosshatch/Eip155"
import { Layer } from "effect"

export const PayerLive = Payer.layer.pipe(
  Layer.provide(
    Accept.layer(KnownAssets).pipe(
      Layer.provide(
        Layer.mergeAll(Erc3009.layer, Permit2.layer).pipe(
          Layer.provide(Eip155Signer.layerMnemonic),
          Layer.provide(Mnemonic.layerEnv),
        ),
      ),
    ),
  ),
)
