import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {CreateServerReturnType} from 'prool'
import {auctionTickpartial,fillOrderPartial,createHTLCSrcPartial, addSafetyDeposit,partialAnnounceOrder, claimHTLCsrcpartial, calculateExpectedSecretIndex } from '../sui/clientpartial';
import Sdk from '@1inch/cross-chain-sdk'
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
import {uint8ArrayToHex, UINT_40_MAX} from '@1inch/byte-utils'
import {ChainConfig, config} from '../../../../tests/config'
import {Wallet} from '../../../../tests/wallet'
import {Resolver} from '../../../../tests/resolversui'
import {EscrowFactory} from '../../../../tests/escrow-factory'
import factoryContract from '../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json'
import resolverContract from '../dist/contracts/Resolver.sol/Resolver.json'
import {MerkleTree} from 'merkletreejs'
import { sha256 } from 'ethers';


import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';


const {Address, HashLock, TimeLocks, Immutables} = Sdk

jest.setTimeout(1000 * 60 * 20)

const userPk = '0x38c4aadf07a344bd5f5baedc7b43f11a9b863cdd16242f3b94a53541ad19fedc'
const resolverPk = '0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66'
const SUI_PRIVATE_KEY_RESOLVER = process.env.SUI_PRIVATE_KEY_RESOLVER!;

const suiKeypairResolver = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_RESOLVER, 'hex'));
const suiAddressResolver = suiKeypairResolver.getPublicKey().toSuiAddress();

export const DEPLOYED_CONTRACTS = {
    escrowFactory: '0xfde41A17EBfA662867DA7324C0Bf5810623Cb3F8', 
    resolver: '0x1Ae0817d98a8A222235A2383422e1A1c03d73e3a'      
}
    // const srcChainId = config.chain.source.chainId
    // const dstChainId = config.chain.destination.chainId

    type Chain = {
        node?: CreateServerReturnType | undefined
        provider: JsonRpcProvider
        escrowFactory: string
        resolver: string
    }

    let dst: Chain
    let dstChainUser: Wallet
    let dstChainResolver: Wallet
    let dstResolverContract: Wallet
    let dstFactory: EscrowFactory
    let resolverInstance: Resolver  // ✅ NEW: Separate variable for the Resolver class instance

    async function increaseTime(t: number): Promise<void> {
        await dst.provider.send('evm_increaseTime', [t])
    }

    export async function runInitialisation()  {
        dst = await initChain(config.chain.destination)

        dstChainUser = new Wallet(userPk, dst.provider)
        dstChainResolver = new Wallet(resolverPk, dst.provider)

        dstFactory = new EscrowFactory(dst.provider, dst.escrowFactory)

        // Transfer ETH to resolver contract for gas
        await dstChainResolver.transfer(dst.resolver, parseEther('0.0001'))

        // ✅ 1. Transfer USDC directly to the resolver CONTRACT
        await dstChainResolver.transferToken(
            config.chain.destination.tokens.USDC.address,
            dst.resolver, // This is the resolver CONTRACT address
            parseUnits('100', 6) // Give contract enough USDC
        );

        // ✅ 2. Make the resolver CONTRACT approve the escrow factory
        const usdcInterface = new Interface([
            'function approve(address spender, uint256 amount) returns (bool)'
        ]);
        resolverInstance = new Resolver(
            dst.resolver, // srcAddress - use actual resolver address
            dst.resolver // dstAddress - this is the deployed resolver contract address
        );


        const approveCalldata = usdcInterface.encodeFunctionData('approve', [
            dst.escrowFactory, // Approve the factory
            MaxUint256 // Unlimited approval
        ]);

        const resolverInterface = new Interface(resolverContract.abi);
        
        await dstChainResolver.send({
            to: dst.resolver,
            data: resolverInterface.encodeFunctionData('arbitraryCalls', [
                [config.chain.destination.tokens.USDC.address], // Target: USDC contract
                [approveCalldata] // Call: approve(factory, MaxUint256)
            ])
        });
        
        console.log('✅ Resolver contract has USDC and approved factory');
    }



async function initChainWithPredeployedContracts(
    cnf: ChainConfig
): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    const {provider} = await getProvider(cnf)
    
    // Verify contracts exist at the specified addresses
    const escrowFactoryCode = await provider.getCode(DEPLOYED_CONTRACTS.escrowFactory)
    const resolverCode = await provider.getCode(DEPLOYED_CONTRACTS.resolver)
    
    if (escrowFactoryCode === '0x') {
        throw new Error(`No contract found at EscrowFactory address: ${DEPLOYED_CONTRACTS.escrowFactory}`)
    }
    
    if (resolverCode === '0x') {
        throw new Error(`No contract found at Resolver address: ${DEPLOYED_CONTRACTS.resolver}`)
    }
    
    console.log(`[${cnf.chainId}]`, `Using existing EscrowFactory at`, DEPLOYED_CONTRACTS.escrowFactory)
    console.log(`[${cnf.chainId}]`, `Using existing Resolver at`, DEPLOYED_CONTRACTS.resolver)

    return {
        provider, 
        resolver: DEPLOYED_CONTRACTS.resolver, 
        escrowFactory: DEPLOYED_CONTRACTS.escrowFactory
    }
}


async function initChain(
    cnf: ChainConfig
): Promise<{node?: CreateServerReturnType; provider: JsonRpcProvider; escrowFactory: string; resolver: string}> {
    const {provider} = await getProvider(cnf);
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider);

    const factoryParams = [
        cnf.limitOrderProtocol,
        cnf.wrappedNative,
        Address.fromBigInt(0n).toString(),
        deployer.address,
        60 * 30,
        60 * 30
    ];

    const escrowFactory = await deploy(
        factoryContract,
        factoryParams,
        provider,
        deployer
    );
    console.log(`[${cnf.chainId}]`, `Escrow factory contract deployed to`, escrowFactory)



    const resolverParams = [
        escrowFactory,
        cnf.limitOrderProtocol,
        computeAddress(resolverPk)
    ];

    const resolver = await deploy(
        resolverContract,
        resolverParams,
        provider,
        deployer
    );
    console.log(`[${cnf.chainId}]`, `Resolver contract deployed to`, resolver)


    return {provider, resolver, escrowFactory};
}

async function getProvider(cnf: ChainConfig): Promise<{provider: JsonRpcProvider}> {
    const provider = new JsonRpcProvider(cnf.url, cnf.chainId, {
        cacheTimeout: -1,
        staticNetwork: true
    });

    return {provider};
}

async function deploy(
    json: {abi: any; bytecode: any},
    params: unknown[],
    provider: JsonRpcProvider,
    deployer: SignerWallet
): Promise<string> {
    const factory = new ContractFactory(json.abi, json.bytecode, deployer);
    const deployed = await factory.deploy(...params);
    await deployed.waitForDeployment();
    return await deployed.getAddress();
}