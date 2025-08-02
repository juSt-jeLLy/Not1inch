import { CreateServerReturnType } from 'prool';
import { JsonRpcProvider } from 'ethers';
import { Wallet as SignerWallet, ContractFactory, Interface, parseEther, parseUnits, MaxUint256 } from 'ethers';
import { Address, TimeLocks, Immutables } from '@1inch/cross-chain-sdk';
import { DEPLOYED_CONTRACTS} from '../../../../tests/main.spec'
import {getProvider} from '../../../../tests/suitoevm.spec'
import resolverContractJson from '../dist/contracts/Resolver.sol/Resolver.json';
import { claimHTLCsrc } from '../../../../sui/clientpartial';
import {ChainConfig} from '../../utils/config'

// 1) Initialize EVM chain using pre-deployed contracts
export async function initChainWithPredeployedContracts(
  cnf: ChainConfig
): Promise<{ provider: JsonRpcProvider; escrowFactory: string; resolver: string }> {
  const { provider } = await getProvider(cnf);
  // Verify contracts exist at specified addresses
  const escrowCode = await provider.getCode(DEPLOYED_CONTRACTS.escrowFactory);
  const resolverCode = await provider.getCode(DEPLOYED_CONTRACTS.resolver);

  if (escrowCode === '0x') {
    throw new Error(`No contract found at EscrowFactory address: ${DEPLOYED_CONTRACTS.escrowFactory}`);
  }
  if (resolverCode === '0x') {
    throw new Error(`No contract found at Resolver address: ${DEPLOYED_CONTRACTS.resolver}`);
  }

  console.log(`Using existing EscrowFactory at ${DEPLOYED_CONTRACTS.escrowFactory}`);
  console.log(`Using existing Resolver at ${DEPLOYED_CONTRACTS.resolver}`);

  return {
    provider,
    escrowFactory: DEPLOYED_CONTRACTS.escrowFactory,
    resolver: DEPLOYED_CONTRACTS.resolver,
  };
}

// 2) Setup resolver contract: fund with ETH and USDC, and approve factory
export async function setupResolverContract(
  resolverPrivateKey: string,
  provider: JsonRpcProvider,
  escrowFactory: string,
  usdcAddress: string
) {
  const signer = new SignerWallet(resolverPrivateKey, provider);
  // 2.1 Transfer ETH to resolver
  await signer.sendTransaction({ to: DEPLOYED_CONTRACTS.resolver, value: parseEther('1') });

  // 2.2 Transfer USDC to resolver
  await signer.sendTransaction({
    to: usdcAddress,
    data: new Interface([ 'function transfer(address to, uint256 amount)' ])
      .encodeFunctionData('transfer', [DEPLOYED_CONTRACTS.resolver, parseUnits('1000', 6)]),
  });

  // 2.3 Approve EscrowFactory
  const approveCalldata = new Interface([ 'function approve(address spender, uint256 amount)' ])
    .encodeFunctionData('approve', [escrowFactory, MaxUint256]);

  const resolverIface = new Interface(resolverContractJson.abi);
  await signer.sendTransaction({
    to: DEPLOYED_CONTRACTS.resolver,
    data: resolverIface.encodeFunctionData('arbitraryCalls', [
      [usdcAddress],
      [approveCalldata]
    ]),
  });

  console.log('Resolver funded and approved factory');
}

// 3) Prepare timelocks and immutables for destination
export function prepareTimeLocks(params: {
  orderHash: string;
  hashLock: string;
  maker: string;
  taker: string;
  token: string;
  amountRaw: string;
  safetyDepositRaw: string;
}) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const locks = TimeLocks.new({
    srcWithdrawal: 2n,
    srcPublicWithdrawal: 3600n,
    srcCancellation: 7200n,
    srcPublicCancellation: 7260n,
    dstWithdrawal: 5n,
    dstPublicWithdrawal: 1800n,
    dstCancellation: 3600n,
  }).setDeployedAt(now);

  const imm = Immutables.new({
    orderHash: params.orderHash,
    hashLock: params.hashLock,
    maker: new Address(params.maker),
    taker: new Address(params.taker),
    token: new Address(params.token),
    amount: parseUnits(params.amountRaw, 6),
    safetyDeposit: parseEther(params.safetyDepositRaw),
    timeLocks: locks,
  });

  return {
    srcTimeLocks: locks.toSrcTimeLocks(),
    dstTimeLocks: locks.toDstTimeLocks(),
    dstImmutables: imm,
    srcCancellation: locks.toSrcTimeLocks().privateCancellation,
  };
}

// 4) Deploy destination escrow on EVM
export async function deployDstEscrow(
  resolverSigner: SignerWallet,
  resolverAddress: string,
  dstImmutables: typeof Immutables.prototype,
  srcCancellation: bigint
) {
  const resolverIface = new Interface(resolverContractJson.abi);
  const tx = await resolverSigner.sendTransaction({
    to: resolverAddress,
    data: resolverIface.encodeFunctionData('deployDst', [
      dstImmutables,
      srcCancellation,
    ]),
  });
  const receipt = await tx.wait();
  return { txHash: receipt.transactionHash, deployedAt: receipt.blockNumber };
}

// 5) Withdraw from destination escrow
export async function withdrawDstEscrow(
  resolverSigner: SignerWallet,
  resolverAddress: string,
  escrowAddress: string,
  secret: string,
  dstImmutables: typeof Immutables.prototype
) {
  const resolverIface = new Interface(resolverContractJson.abi);
  const tx = await resolverSigner.sendTransaction({
    to: resolverAddress,
    data: resolverIface.encodeFunctionData('withdraw', [
      'dst',
      escrowAddress,
      secret,
      dstImmutables,
    ]),
  });
  return tx.wait();
}



export async function claimOnSui(htlcId: string, secret: string) {
  return claimHTLCsrc(htlcId, secret);
}
