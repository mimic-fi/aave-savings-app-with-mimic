import { Chains, fp, OpType, randomEvmAddress } from '@mimicprotocol/sdk'
import { Call, Context, EvmCallQueryMock, runTask } from '@mimicprotocol/test-ts'
import { expect } from 'chai'
import { Interface } from 'ethers'

import AavePool from '../abis/AavePool.json'
import ERC20Abi from '../abis/ERC20.json'

const AavePoolInterface = new Interface(AavePool)
const ERC20Interface = new Interface(ERC20Abi)

describe('Invest Task', () => {
  const taskDir = './build'

  describe('when the chain is supported', () => {
    const chainId = Chains.Optimism
    const aavePool = '0x794a61358d6845594f94dc1db02a252b5b4814ad'
    const decimals = 6

    const context: Context = {
      user: randomEvmAddress(),
      settlers: [{ address: randomEvmAddress(), chainId }],
      timestamp: Date.now(),
    }

    const inputs = {
      chainId,
      token: randomEvmAddress(),
      amount: '15.2',
      maxFee: '0.5',
    }

    const calls: EvmCallQueryMock[] = [
      {
        request: { to: inputs.token, chainId, fnSelector: ERC20Interface.getFunction('decimals')!.selector },
        response: { value: decimals.toString(), abiType: 'uint8' },
      },
    ]

    it('produces the expected intents', async () => {
      const result = await runTask(taskDir, context, { inputs, calls })
      expect(result.success).to.be.true
      expect(result.timestamp).to.be.equal(context.timestamp)

      const intents = result.intents as Call[]
      expect(intents).to.have.lengthOf(1)

      expect(intents[0].op).to.be.equal(OpType.EvmCall)
      expect(intents[0].settler).to.be.equal(context.settlers?.[0].address)
      expect(intents[0].user).to.be.equal(context.user)
      expect(intents[0].chainId).to.be.equal(inputs.chainId)

      expect(intents[0].maxFees).to.have.lengthOf(1)
      expect(intents[0].maxFees[0].token).to.be.equal(inputs.token)
      expect(intents[0].maxFees[0].amount).to.be.equal(fp(inputs.maxFee, decimals).toString())

      expect(intents[0].calls).to.have.lengthOf(2)

      const expectedApproveData = ERC20Interface.encodeFunctionData('approve', [aavePool, fp(inputs.amount, decimals)])
      expect(intents[0].calls[0].target).to.be.equal(inputs.token)
      expect(intents[0].calls[0].value).to.be.equal('0')
      expect(intents[0].calls[0].data).to.be.equal(expectedApproveData)

      const expectedSupplyData = AavePoolInterface.encodeFunctionData('supply(address,uint256,address,uint16)', [
        inputs.token,
        fp(inputs.amount, decimals),
        context.user,
        0,
      ])
      expect(intents[0].calls[1].target).to.be.equal(aavePool)
      expect(intents[0].calls[1].value).to.be.equal('0')
      expect(intents[0].calls[1].data).to.be.equal(expectedSupplyData)
    })
  })

  describe('when the chain is not supported', () => {
    const chainId = Chains.Gnosis

    const context: Context = {
      user: randomEvmAddress(),
      settlers: [{ address: randomEvmAddress(), chainId }],
      timestamp: Date.now(),
    }

    const inputs = {
      chainId,
      token: randomEvmAddress(),
      amount: '15.2',
      maxFee: '0.5',
    }

    const calls: EvmCallQueryMock[] = [
      {
        request: { to: inputs.token, chainId, fnSelector: ERC20Interface.getFunction('decimals')!.selector },
        response: { value: '6', abiType: 'uint8' },
      },
    ]

    it('throws an error', async () => {
      const result = await runTask(taskDir, context, { inputs, calls })
      expect(result.success).to.be.false
      expect(result.intents).to.have.lengthOf(0)

      expect(result.logs).to.have.lengthOf(1)
      expect(result.logs[0]).to.include(`Invalid chain ${chainId}`)
    })
  })
})
