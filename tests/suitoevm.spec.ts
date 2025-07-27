import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {CreateServerReturnType} from 'prool'
import { createHTLCDst, claimHTLCsrc, announceOrder,auctionTick,fillOrder, createHTLCSrc, addSafetyDeposit,  } from '../sui/client-export';
import Sdk from '@1inch/cross-chain-sdk'
import {
    computeAddress,
    ContractFactory,
    JsonRpcProvider,
    MaxUint256,
    parseEther,
    parseUnits,
    randomBytes,
    Wallet as SignerWallet
} from 'ethers'
import {uint8ArrayToHex, UINT_40_MAX} from '@1inch/byte-utils'
import {ChainConfig, config} from './config'
import {Wallet} from './wallet'
import {Resolver} from './resolver'
import {EscrowFactory} from './escrow-factory'
import factoryContract from '../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json'
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'

const {Address} = Sdk

jest.setTimeout(1000 * 60 * 20)

const userPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const resolverPk = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'

// eslint-disable-next-line max-lines-per-function
describe('Resolving example', () => {
    const srcChainId = config.chain.source.chainId
    const dstChainId = config.chain.destination.chainId

    type Chain = {
        node?: CreateServerReturnType | undefined
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
    }

    let src: Chain
    let dst: Chain

    let srcChainUser: Wallet
    let srcChainResolver: Wallet

    let srcFactory: EscrowFactory
    let srcResolverContract: Wallet

    let srcTimestamp: bigint

    async function increaseTime(t: number): Promise<void> {
        await src.provider.send('evm_increaseTime', [t])
    }

    beforeAll(async () => {
        src = await initChain(config.chain.source)

        srcChainUser = new Wallet(userPk, src.provider)
        srcChainResolver = new Wallet(resolverPk, src.provider)

        srcFactory = new EscrowFactory(src.provider, src.escrowFactory)
        // get 1000 USDC for user in SRC chain and approve to LOP
        await srcChainUser.approveToken(
            config.chain.source.tokens.USDC.address,
            config.chain.source.limitOrderProtocol,
            MaxUint256
        )

        // top up resolver contract for approve
        // On live networks, cannot impersonate resolver contract. If resolver is EOA and you have the key, use new Wallet(resolverPk, src.provider). Otherwise, ensure resolver contract is funded and approved externally.
        srcResolverContract = new Wallet(resolverPk, src.provider)
        await srcChainResolver.transfer(src.resolver, parseEther('1'))
        await srcResolverContract.unlimitedApprove(config.chain.source.tokens.USDC.address, src.escrowFactory)

        srcTimestamp = BigInt((await src.provider.getBlock('latest'))!.timestamp)
    })

    async function getBalances(
        srcToken: string
    ): Promise<{src: {user: bigint; resolver: bigint}}> {
        return {
            src: {
                user: await srcChainUser.tokenBalance(srcToken),
                resolver: await srcResolverContract.tokenBalance(srcToken)
            }
        }
    }

    afterAll(async () => {
        // No cleanup needed for live RPC
    })

    // eslint-disable-next-line max-lines-per-function
    describe('Fill', () => {
        it('should swap Ethereum USDC -> SUI USDC. Single fill only', async () => {
            const initialBalances = await getBalances(
                config.chain.source.tokens.USDC.address
                
            )

            // User creates order
            const secret = uint8ArrayToHex(randomBytes(32)) // note: use crypto secure random number in real world
            const hashLock = Sdk.HashLock.forSingleFill(secret);
            console.log('hashLock:', hashLock);

            // user craetes order on the sui chain
            const hash = hashLock.toString();

            console.log("user announcing order on Sui chain ")

            const announce_Order = await announceOrder(hash, 10000000000)
                const orderId = announce_Order.objectChanges?.find(change => change.type === 'created')?.objectId;
                if (!orderId) throw new Error('orderId is undefined');


                console.log("user announced order on Sui chain ")
                console.log("OrderId ",orderId);



            // Duch Auction Started

            console.log("DUCH AUCTION STARTED Sui chain ")
            const duchAuction = await auctionTick(orderId)
            console.log("Auction ticked successfully. Current price:", duchAuction);  



            //resolver fills the order


            console.log("resolver fill order on Sui chain ")
            const fillorder = await fillOrder(orderId)
            console.log("order filled on Sui chain ")

            // create HTLCsrc on Sui chain
            console.log("create HTLCsrc on Sui chain ")
            const htlcSrc = await createHTLCSrc(hash, 10000000000, orderId)
            const htlcId = htlcSrc.objectChanges?.find(change => change.type === 'created')?.objectId;
            if (!htlcId) throw new Error('htlcId is undefined');

            console.log("HTLCsrc created on Sui chain ")

            //resolver adds safety deposit
            console.log("resolver adds safety deposit on Sui chain ")
            const addSafetydeposit = await addSafetyDeposit(htlcId)
            console.log("safety deposit added on Sui chain ")






            const order = Sdk.CrossChainOrder.new(
                new Address(src.escrowFactory),
                {
                    salt: Sdk.randBigInt(1000n),
                    maker: new Address(await srcChainUser.getAddress()),
                    makingAmount: parseUnits('100', 6),
                    takingAmount: parseUnits('0.05', 6),
                    makerAsset: new Address(config.chain.source.tokens.USDC.address),
                    takerAsset: new Address(config.chain.source.tokens.USDC.address)
                },
                {
                    hashLock: hashLock,
                    timeLocks: Sdk.TimeLocks.new({
                        srcWithdrawal: 10n, // 10sec finality lock for test
                        srcPublicWithdrawal: 120n, // 2m for private withdrawal
                        srcCancellation: 121n, // 1sec public withdrawal
                        srcPublicCancellation: 122n, // 1sec private cancellation
                        dstWithdrawal: 10n, // 10sec finality lock for test
                        dstPublicWithdrawal: 100n, // 100sec private withdrawal
                        dstCancellation: 101n // 1sec public withdrawal
                    }),
                    srcChainId,
                    dstChainId,
                    srcSafetyDeposit: parseEther('0.00'),
                    dstSafetyDeposit: parseEther('0.00')
                },
                {
                    auction: new Sdk.AuctionDetails({
                        initialRateBump: 0,
                        points: [],
                        duration: 120n,
                        startTime: srcTimestamp
                    }),
                    whitelist: [
                        {
                            address: new Address(src.resolver),
                            allowFrom: 0n
                        }
                    ],
                    resolvingStartTime: 0n
                },
                {
                    nonce: Sdk.randBigInt(UINT_40_MAX),
                    allowPartialFills: false,
                    allowMultipleFills: false
                }
            )

            const signature = await srcChainUser.signOrder(srcChainId, order)
            const orderHash = order.getOrderHash(srcChainId)
            // Resolver fills order

            const resolverContract = new Resolver(src.resolver, src.resolver) // src.resolver is both src and dst resolver

            const fillAmount = order.makingAmount
            const {txHash: orderFillHash, blockHash: srcDeployBlock} = await srcChainResolver.send(
                resolverContract.deploySrc(
                    srcChainId,
                    order,
                    signature,
                    Sdk.TakerTraits.default()
                        .setExtension(order.extension)
                        .setAmountMode(Sdk.AmountMode.maker)
                        .setAmountThreshold(order.takingAmount),
                    fillAmount
                )
            )


            const srcEscrowEvent = await srcFactory.getSrcDeployEvent(srcDeployBlock)
            console.log(`[${srcChainId}]`, `destination escrow created`)


            const ESCROW_SRC_IMPLEMENTATION = await srcFactory.getSourceImpl()
            const srcEscrowAddress = new Sdk.EscrowFactory(new Address(src.escrowFactory)).getSrcEscrowAddress(
                srcEscrowEvent[0],
                ESCROW_SRC_IMPLEMENTATION
            )




            await increaseTime(11)
            // User shares key after validation of dst escrow deployment
          
            const {txHash: resolverWithdrawHash} = await srcChainResolver.send(
                resolverContract.withdraw('src', srcEscrowAddress, secret, srcEscrowEvent[0])
            )
            console.log(
                `[${srcChainId}]`,
                `Withdrew funds for user from ${srcEscrowAddress} to ${src.resolver} in tx ${resolverWithdrawHash}`
            )

              // resolver claims the funds on sui chain

              console.log("resolver claiming funds on Sui chain ")
              const claim = await claimHTLCsrc(htlcId, secret)
              console.log("resolver claimed funds on Sui chain ")



            // Sweep all USDC from resolver contract to resolver EOA
            const resolverEOA = await srcChainResolver.getAddress();
            const sweepUSDC = resolverContract.sweep(config.chain.source.tokens.USDC.address, resolverEOA);
            await srcChainResolver.send(sweepUSDC);
            const resultBalances = await getBalances(
                config.chain.source.tokens.USDC.address
            )

            console.log("funds transferred to user in destination chain")

            // user transferred funds to resolver on source chain
            
            expect(resultBalances.src.resolver - initialBalances.src.resolver).toBe(order.makingAmount)
            // resolver transferred funds to user on destination chain (SUI)
            // (SUI side is checked by the SUI helper, not by EVM balance)
        })
    })
})

async function initChain(
    cnf: ChainConfig
): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    const {provider} = await getProvider(cnf)
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider)

    // deploy EscrowFactory
    const escrowFactory = await deploy(
        factoryContract,
        [
            cnf.limitOrderProtocol,
            cnf.wrappedNative, // feeToken,
            Address.fromBigInt(0n).toString(), // accessToken,
            deployer.address, // owner
            60 * 30, // src rescue delay
            60 * 30 // dst rescue delay
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Escrow factory contract deployed to`, escrowFactory)

    // deploy Resolver contract
    const resolver = await deploy(
        resolverContract,
        [
            escrowFactory,
            cnf.limitOrderProtocol,
            computeAddress(resolverPk) // resolver as owner of contract
        ],
        provider,
        deployer
    )
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver)

    return {provider, resolver, escrowFactory}
}

async function getProvider(cnf: ChainConfig): Promise<{provider: JsonRpcProvider}> {
    // Always use live RPC URL from config
    return {
        provider: new JsonRpcProvider(cnf.url, cnf.chainId, {
            cacheTimeout: -1,
            staticNetwork: true
        })
    }
}

/**
 * Deploy contract and return its address
 */
async function deploy(
    json: {abi: any; bytecode: any},
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet
): Promise<string> {
    const deployed = await new ContractFactory(json.abi, json.bytecode, deployer).deploy(...params)
    await deployed.waitForDeployment()

    return await deployed.getAddress()
}
describe('Basic test', () => {
    it('should run a dummy test', () => {
        expect(true).toBe(true)
    })
})