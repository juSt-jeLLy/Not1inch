'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  SuiClientProvider,
  WalletProvider,
  createNetworkConfig
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') }
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect={true}>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}