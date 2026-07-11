import * as Asset from "../Asset.ts"
import { SolanaAddress } from "./SolanaAddress.ts"

export const SolanaAsset = SolanaAddress.pipe(Asset.brand)
