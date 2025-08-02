import 'dotenv/config'
import './config'
import { CreateServerReturnType } from 'prool'
import {
  claimHTLCsrc,
  announceStandardOrder,
  auctionTick,
  fillStandardOrder,
  createHTLCSrc,
  addSafetyDeposit
} from '../../../../sui/clientpartial'

import Sdk from '@1inch/cross-chain-sdk'
import { Address, TimeLocks, Immutables, HashLock} from '@1inch/cross-chain-sdk'
import {
  computeAddress,
  ContractFactory,
  JsonRpcProvider,
  MaxUint256,
  parseEther,
  parseUnits,
  randomBytes,
  Wallet as SignerWallet,
  Interface
} from 'ethers'

import { uint8ArrayToHex } from '@1inch/byte-utils'
import { ChainConfig, config } from '../../../../tests/config'
import { Wallet } from '../../../../tests/wallet'
import { Resolver } from '../../../../tests/resolversui'
import { EscrowFactory } from '../../../../tests/escrow-factory'
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'
import {abi} from '../../../../dist/contracts/Resolver.sol/Resolver.json'
import factoryContract from '../dist/contracts/EscrowFactory.sol/EscrowFactory.json'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'

// const { Address, HashLock, TimeLocks, Immutables } = Sdk

export const DEPLOYED_CONTRACTS = {
  escrowFactory: '0xfde41A17EBfA662867DA7324C0Bf5810623Cb3F8',
  resolver: '0x1Ae0817d98a8A222235A2383422e1A1c03d73e3a'
}

const userPk = '0x38c4aadf07a344bd5f5baedc7b43f11a9b863cdd16242f3b94a53541ad19fedc'
const resolverPk = '0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66'
const SUI_PRIVATE_KEY_RESOLVER = process.env.SUI_PRIVATE_KEY_RESOLVER!
const suiKeypairResolver = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_RESOLVER, 'hex'))
const suiAddressResolver = suiKeypairResolver.getPublicKey().toSuiAddress()

type Chain = {
  node?: CreateServerReturnType | undefined
  provider: JsonRpcProvider
  escrowFactory: string
  resolver: string
}

async function increaseTime(t: number, provider: JsonRpcProvider) {
  await provider.send('evm_increaseTime', [t])
  await provider.send('evm_mine', [])
}

async function initChain(cnf: ChainConfig): Promise<Chain> {
  const { provider } = await getProvider(cnf)
  return {
    provider,
    escrowFactory: DEPLOYED_CONTRACTS.escrowFactory,
    resolver: DEPLOYED_CONTRACTS.resolver
  }
}

export async function getProvider(cnf: ChainConfig): Promise<{ provider: JsonRpcProvider }> {
  const provider = new JsonRpcProvider(cnf.url, cnf.chainId, {
    cacheTimeout: -1,
    staticNetwork: true
  })
  return { provider }
}


// export async function initilaise(){
    
// }
export async function main(htlcId: string) {
  const srcChainId = config.chain.source.chainId
  const dstChainId = config.chain.destination.chainId

  const dst = await initChain(config.chain.destination)

  const dstChainUser = new Wallet(userPk, dst.provider)
  const dstChainResolver = new Wallet(resolverPk, dst.provider)
  const dstFactory = new EscrowFactory(dst.provider, dst.escrowFactory)

  await dstChainResolver.transfer(dst.resolver, parseEther('0.0001'))

  await dstChainResolver.transferToken(
    config.chain.destination.tokens.USDC.address,
    dst.resolver,
    parseUnits('0.1', 6)
  )

  const usdcInterface = new Interface([
    'function approve(address spender, uint256 amount) returns (bool)'
  ])
  const resolverInstance = new Resolver(dst.resolver, dst.resolver)
  const approveCalldata = usdcInterface.encodeFunctionData('approve', [dst.escrowFactory, MaxUint256])
  // const resolverInterface = new Interface(resolverContract.abi)
  const resolverInterface = new Interface(abi)

  await dstChainResolver.send({
    to: dst.resolver,
    data: resolverInterface.encodeFunctionData('arbitraryCalls', [
      [config.chain.destination.tokens.USDC.address],
      [approveCalldata]
    ])
  })

  console.log('✅ Resolver contract has USDC and approved factory')

  const secret = uint8ArrayToHex(randomBytes(32))
  const hashLock = HashLock.forSingleFill(secret)
  const orderHash = uint8ArrayToHex(randomBytes(32))
  const hash = hashLock.toString()

  const currentTime = BigInt(Math.floor(Date.now() / 1000))
  const timeLocks = TimeLocks.new({
    srcWithdrawal: 2n,
    srcPublicWithdrawal: 3600n,
    srcCancellation: 7200n,
    srcPublicCancellation: 7260n,
    dstWithdrawal: 5n,
    dstPublicWithdrawal: 1800n,
    dstCancellation: 3600n
  }).setDeployedAt(currentTime)

  const dstImmutables = Immutables.new({
    orderHash: orderHash,
    hashLock: hashLock,
    maker: new Address(await dstChainUser.getAddress()),
    taker: new Address(dst.resolver),
    token: new Address(config.chain.destination.tokens.USDC.address),
    amount: parseUnits('0.1', 6),
    safetyDeposit: parseEther('0.00001'),
    timeLocks: timeLocks
  })

  if (timeLocks.toDstTimeLocks().privateCancellation >= timeLocks.toSrcTimeLocks().privateCancellation) {
    throw new Error('Invalid timelock relationship')
  }

  console.log('Deploying destination escrow...')
  const { txHash: dstDepositHash, blockTimestamp: dstDeployedAt } = await dstChainResolver.send(
    resolverInstance.deployDst(dstImmutables, timeLocks.toSrcTimeLocks().privateCancellation)
  )
  console.log('Deployed escrow TX:', dstDepositHash)

  const dstImplementation = await dstFactory.getDestinationImpl()
  const escrowFactory = new Sdk.EscrowFactory(new Address(dst.escrowFactory))
  const dstEscrowAddress = escrowFactory.getEscrowAddress(
    dstImmutables.withDeployedAt(dstDeployedAt).hash(),
    dstImplementation
  )
  console.log('Escrow Address:', dstEscrowAddress.toString())

  console.log('Waiting for timelock...')
  await increaseTime(10, dst.provider)

  console.log('Withdrawing from destination escrow...')
  await dstChainResolver.send(
    resolverInstance.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt))
  )

  console.log('Claiming HTLC on Sui...')
  await claimHTLCsrc(htlcId, secret)

  const resolverEOA = await dstChainResolver.getAddress()
  await dstChainResolver.send(resolverInstance.sweepDst('0x0000000000000000000000000000000000000000', resolverEOA))

  console.log('🎉 Cross-chain swap complete')
}

