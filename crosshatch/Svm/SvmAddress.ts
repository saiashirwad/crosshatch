import { Config, flow, Schema as S } from "effect"

export const SvmAddress = S.String.check(S.isPattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)).pipe(
  S.brand("crosshatch/Address"),
  S.brand("crosshatch/SvmAddress"),
)

export const config = flow(Config.string, Config.map(S.decodeUnknownSync(SvmAddress)))
