import { Redacted, Context, Layer, Effect } from "effect"
import { Mnemonic as OxMnemonic } from "ox"
import { privateKeyToAccount, type CustomSource } from "viem/accounts"

import * as Mnemonic from "../Mnemonic.ts"

export class Eip155Signer extends Context.Service<Eip155Signer, CustomSource>()("crosshatch/Eip155/Eip155Signer") {}

export const layerMnemonic = Layer.effect(
  Eip155Signer,
  Mnemonic.Mnemonic.pipe(
    Effect.map((v) => privateKeyToAccount(OxMnemonic.toPrivateKey(Redacted.value(v), { as: "Hex" }))),
  ),
)
