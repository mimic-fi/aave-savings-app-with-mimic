'use client'

import { useAccount, useConfig } from 'wagmi'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Settings } from 'lucide-react'

import { Trigger } from '@mimicprotocol/sdk'
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
import { findCurrentTrigger } from '@/lib/functions'
import { capitalize } from '@/lib/utils'

export function Form() {
  const { toast } = useToast()
  const { address, isConnected } = useAccount()
  const wagmiConfig = useConfig()
  const signer = new WagmiSigner(address || '', wagmiConfig)

  const [chain, setChain] = useState<Chain>(CHAINS.base)
  const [token, setToken] = useState<Token>(TOKENS.base.USDC)
  const [amount, setAmount] = useState('')
  const [maxFee, setMaxFee] = useState('0.1')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [isLoading, setIsLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currentSavingsPlan, setCurrentSavingsPlan] = useState<Trigger | null>(null)
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
        const trigger = await findCurrentTrigger(address)
        setCurrentSavingsPlan(trigger)
      } catch (error) {
        console.error('Error fetching savings plan trigger', error)
        setCurrentSavingsPlan(null)
      } finally {
        setIsLoadingCurrentSavingsPlan(false)
      }
    }

    fetchCurrentSavingsPlan()
  }, [isConnected, address])

  useEffect(() => {
    if (!currentSavingsPlan) return

    const config = currentSavingsPlan.config as unknown as { schedule: string }
    const frequencyFound = getFrequencyFromSchedule(config.schedule)
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
      const trigger = await invest(params)

      toast({
        title: 'Savings Plan Activated',
        description: 'Your savings plan has been created successfully',
        action: (
          <ToastAction
            altText="View"
            onClick={() => window.open(`https://protocol.mimic.fi/triggers/${trigger.sig}`, '_blank')}
          >
            View
          </ToastAction>
        ),
      })

      setCurrentSavingsPlan(trigger)
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
      const params = { trigger: currentSavingsPlan, signer }
      await deactivate(params)

      toast({
        title: 'Savings Plan Deactivated',
        description: 'Your savings plan has been deactivated successfully',
      })

      setCurrentSavingsPlan(null)
      setAmount('')
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
            <span className="font-semibold">This app is only meant to be used with Mimic EIP-7702 smart accounts.</span>{' '}
            <br />
            <span className="text-destructive/90">
              You can upgrade your existing wallet by following{' '}
              <a
                href="https://docs.mimic.fi/examples/upgrade-your-eoa-to-a-mimic-7702"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
              >
                this guide
              </a>
              .
            </span>
          </div>
        )}

        {isConnected && !isSmartAccountLoading && isSmartAccount && (
          <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
            <span className="font-semibold">Your wallet is a Mimic EIP-7702 smart account.</span>
          </div>
        )}

        {isConnected && isSmartAccountLoading && (
          <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
            Checking EIP-7702 delegation ...
          </div>
        )}

        {currentSavingsPlan && (
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Current Aave savings plan detected</div>
            <a
              href={`https://protocol.mimic.fi/triggers/${currentSavingsPlan.sig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-violet-500 hover:text-violet-400 transition-colors"
            >
              view
            </a>
          </div>
        )}

        {!currentSavingsPlan && (
          <div className="space-y-1 flex items-end justify-between">
            <Label className="text-sm font-medium">Set up your savings plan on Aave</Label>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl hover:bg-secondary"
                  disabled={isFormDisabled}
                >
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-fee-setting" className="text-sm text-muted-foreground">
                      Max fee
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="max-fee-setting"
                        type="number"
                        placeholder="0.0"
                        value={maxFee}
                        onChange={(e) => setMaxFee(e.target.value)}
                        className="h-11 bg-secondary/50 border-border"
                        min="0"
                        step="0.01"
                        disabled={isFormDisabled}
                      />
                      <span className="text-muted-foreground">{token.symbol}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Maximum fee you’re willing to pay per execution.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
            className="w-full text-lg h-14 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
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
