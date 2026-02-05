import { Address, BigInt, ChainId, environment, ERC20Token, EvmCallBuilder, TokenAmount } from '@mimicprotocol/lib-ts'

import { AavePoolUtils } from './types/AavePool'
import { ERC20Utils } from './types/ERC20'
import { inputs } from './types'

export default function main(): void {
  const context = environment.getContext()
  const token = new ERC20Token(inputs.token, inputs.chainId)
  const amount = BigInt.fromStringDecimal(inputs.amount, token.decimals)
  const maxFee = TokenAmount.fromStringDecimal(token, inputs.maxFee)

  const aaveV3Pool = getAaveV3Pool(inputs.chainId)
  const approveData = ERC20Utils.encodeApprove(aaveV3Pool, amount)
  const supplyData = AavePoolUtils.encodeSupply(token.address, amount, context.user, 0)

  EvmCallBuilder.forChain(inputs.chainId)
    .addCall(token.address, approveData)
    .addCall(aaveV3Pool, supplyData)
    .addMaxFee(maxFee)
    .build()
    .send()
}

function getAaveV3Pool(chainId: i32): Address {
  if (chainId == ChainId.ETHEREUM) return Address.fromString('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2')
  if (chainId == ChainId.ARBITRUM) return Address.fromString('0x794a61358d6845594f94dc1db02a252b5b4814ad')
  if (chainId == ChainId.BASE) return Address.fromString('0xa238dd80c259a72e81d7e4664a9801593f98d1c5')
  if (chainId == ChainId.OPTIMISM) return Address.fromString('0x794a61358d6845594f94dc1db02a252b5b4814ad')
  throw new Error(`Invalid chain ${chainId}`)
}
