import { Config, flow, Schema as S } from "effect"

import { SvmAddress } from "./SvmAddress.ts"

export const SvmAsset = SvmAddress.pipe(S.brand("crosshatch/Asset"))

export const config = flow(Config.string, Config.map(S.decodeUnknownSync(SvmAsset)))
