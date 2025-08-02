import { NetworkEnum } from '@1inch/cross-chain-sdk';

export const ARBITRUM_CONFIG = {
    chainId: NetworkEnum.ARBITRUM,
    rpcUrl: "https://virtual.arbitrum.eu.rpc.tenderly.co/6720346a-9386-4fa1-959c-ebbc2e046090",
    contracts: {
        escrowFactory: '0xcb818a64dd9aa858b96d83cca5a628ff5452f552',
        resolver: '0xb103c05fe2451b9b09dbe45ad78e0c294dd22aaa',
        limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
        wrappedNative: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        USDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
    }
} as const;

export const NETWORK_CONFIGS = {
    arbitrum: ARBITRUM_CONFIG
} as const;
