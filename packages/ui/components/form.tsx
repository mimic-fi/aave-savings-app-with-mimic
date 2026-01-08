'use client'

import { useAccount, useConfig } from 'wagmi'
import { useState, useEffect } from 'react'
import { Config, CronTriggerType } from '@mimicprotocol/sdk'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChainSelector } from '@/components/chain-selector'
import { TokenSelector } from '@/components/token-selector'
import { useToast } from '@/hooks/use-toast'
import { CHAINS, type Chain } from '@/lib/chains'
import { TOKENS, type Token } from '@/lib/tokens'
import { WagmiSigner } from '@/lib/wagmi-signer'
import { ToastAction } from '@/components/ui/toast'
import { useSmartAccountCheck } from '@/hooks/use-smart-account-check'

import { Frequency, CRON_SCHEDULES, invest, deactivate, getFrequencyFromSchedule } from '@/lib/invest'
import { findCurrentConfig } from '@/lib/executions'
import { capitalize } from '@/lib/utils'

export function Form() {
  const { toast } = useToast()
  const { address, isConnected } = useAccount()
  const wagmiConfig = useConfig()
  const signer = new WagmiSigner(address || '', wagmiConfig)

  const [chain, setChain] = useState<Chain>(CHAINS.base)
  const [token, setToken] = useState<Token>(TOKENS.base.USDC)
  const [amount, setAmount] = useState('')
  const [maxFee, setMaxFee] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [isLoading, setIsLoading] = useState(false)
  const [currentSavingsPlan, setCurrentSavingsPlan] = useState<Config | null>(null)
  const [isLoadingCurrentSavingsPlan, setIsLoadingCurrentSavingsPlan] = useState(false)
  const { isSmartAccount, isSmartAccountLoading } = useSmartAccountCheck(chain)
  const isFormDisabled = isLoadingCurrentSavingsPlan || !!currentSavingsPlan

  useEffect(() => {
    const tokens = TOKENS[chain.key]
    const firstSymbol = Object.keys(tokens ?? {})[0]
    if (firstSymbol) setToken(tokens[firstSymbol])
  }, [chain])

  useEffect(() => {
    const fetchCurrentSavingsPlan = async () => {
      try {
        if (!isConnected || !address) {
          setCurrentSavingsPlan(null)
          return
        }

        setIsLoadingCurrentSavingsPlan(true)
        const config = await findCurrentConfig(address)
        setCurrentSavingsPlan(config)
      } catch (error) {
        console.error('Error fetching savings plan config', error)
        setCurrentSavingsPlan(null)
      } finally {
        setIsLoadingCurrentSavingsPlan(false)
      }
    }

    fetchCurrentSavingsPlan()
  }, [isConnected, address])

  useEffect(() => {
    if (!currentSavingsPlan) return

    const trigger = currentSavingsPlan.trigger as unknown as { schedule: string }
    const frequencyFound = getFrequencyFromSchedule(trigger.schedule)
    if (frequencyFound) setFrequency(frequencyFound)

    const inputs = currentSavingsPlan.input
    setAmount(String(inputs.amount))
    setMaxFee(String(inputs.maxFee))

    const chain = Object.values(CHAINS).find((chain: Chain) => chain.id == inputs.chainId)
    if (chain) {
      setChain(chain)
      const token = Object.values(TOKENS[chain.key]).find((token: Token) => token.address == inputs.token)
      if (token) setToken(token)
    }
  }, [currentSavingsPlan])

  const handleActivate = async () => {
    if (!amount || Number.parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount to invest',
        variant: 'destructive',
      })
      return
    }

    if (!maxFee || Number.parseFloat(maxFee) <= 0) {
      toast({
        title: 'Invalid Max Fee',
        description: 'Please enter a valid max fee to invest',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      const params = { chain, token, amount, maxFee, frequency, signer }
      const config = await invest(params)

      toast({
        title: 'Savings Plan Activated',
        description: 'Your savings plan has been created successfully',
        action: (
          <ToastAction
            altText="View config"
            onClick={() => window.open(`https://protocol.mimic.fi/configs/${config.sig}`, '_blank')}
          >
            View
          </ToastAction>
        ),
      })

      setCurrentSavingsPlan(config)
    } catch (error) {
      toast({
        title: 'Activation Failed',
        description: error instanceof Error ? error.message : 'Failed to activate savings plan',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!currentSavingsPlan) return
    setIsLoading(true)

    try {
      const params = { config: currentSavingsPlan, signer }
      await deactivate(params)

      toast({
        title: 'Savings Plan Deactivated',
        description: 'Your savings plan has been deactivated successfully',
      })

      setCurrentSavingsPlan(null)
      setAmount('')
      setMaxFee('')
    } catch (error) {
      toast({
        title: 'Deactivation Failed',
        description: error instanceof Error ? error.message : 'Failed to deactivate savings plan',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl p-6 bg-card border-border">
      <div className="space-y-6">
        {isConnected && !isSmartAccountLoading && !isSmartAccount && (
          <div className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            This app can be used only for <span className="font-semibold">EIP-7702 delegated</span> accounts.
          </div>
        )}

        {isConnected && !isSmartAccountLoading && isSmartAccount && (
          <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
            <span className="font-semibold">EIP-7702 smart account checked.</span>
          </div>
        )}

        {isConnected && isSmartAccountLoading && (
          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
            Checking EIP-7702 delegation…
          </div>
        )}

        {currentSavingsPlan && (
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Current Aave savings plan detected</div>
            <a
              href={`https://protocol.mimic.fi/configs/${currentSavingsPlan.sig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-violet-500 hover:text-violet-400 transition-colors"
            >
              view
            </a>
          </div>
        )}

        {!currentSavingsPlan && (
          <div className="space-y-1">
            <div className="text-sm font-medium">Set up your savings plan on Aave</div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="w-36 shrink-0">
              <Label className="text-muted-foreground">Chain</Label>
            </div>
            <div className="w-36 shrink-0">
              <Label className="text-muted-foreground">Token</Label>
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-muted-foreground">Amount</Label>
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-muted-foreground">Max fee</Label>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <div className={`w-36 shrink-0 ${isFormDisabled ? 'pointer-events-none opacity-70' : ''}`}>
              <ChainSelector value={chain} onChange={setChain} />
            </div>
            <div className={`w-36 shrink-0 ${isFormDisabled ? 'pointer-events-none opacity-70' : ''}`}>
              <TokenSelector chain={chain} value={token} onChange={setToken} />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 bg-secondary/50 border-border text-lg text-right"
                disabled={isFormDisabled}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                type="number"
                placeholder="0.0"
                value={maxFee}
                onChange={(e) => setMaxFee(e.target.value)}
                className="h-12 bg-secondary/50 border-border text-lg text-right"
                disabled={isFormDisabled}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-muted-foreground">Frequency</Label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(CRON_SCHEDULES) as Frequency[]).map((f) => (
              <Button
                key={f}
                type="button"
                variant={frequency === f ? 'default' : 'secondary'}
                className="rounded-xl"
                onClick={() => setFrequency(f)}
                disabled={isFormDisabled}
              >
                {capitalize(f)}
              </Button>
            ))}
          </div>
        </div>

        {currentSavingsPlan ? (
          <Button
            size="lg"
            variant="destructive"
            className="w-full text-lg h-14"
            onClick={handleDeactivate}
            disabled={isLoading || !isConnected || !isSmartAccount}
          >
            {isLoading ? 'Deactivating...' : 'Deactivate plan'}
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full text-lg h-14 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            onClick={handleActivate}
            disabled={isLoading || !isConnected || !isSmartAccount}
          >
            {isLoading
              ? 'Activating...'
              : !isConnected
                ? 'Connect wallet'
                : isSmartAccountLoading
                  ? 'Checking account...'
                  : !isSmartAccount
                    ? 'EIP-7702 required'
                    : 'Activate plan'}
          </Button>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Powered by{' '}
          <a
            href="https://www.mimic.fi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-500 hover:text-violet-400 transition-colors"
          >
            Mimic
          </a>
        </div>
      </div>
    </Card>
  )
}
