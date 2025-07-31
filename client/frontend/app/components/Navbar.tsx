'use client';

import { useState, useEffect } from 'react';
import { WalletIcon } from "@heroicons/react/24/outline";
import { ConnectModal, useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
// ETH wallet connect button component
function ConnectButton() {
  return <appkit-button />
}

interface NavbarProps {
  requiredWalletType: 'ethereum' | 'sui' | null;
  isEthWalletConnected: boolean;
  isSuiWalletConnected: boolean;
  onEthWalletConnect: (connected: boolean) => void;
}

export default function Navbar({ 
  requiredWalletType, 
  isEthWalletConnected, 
  isSuiWalletConnected, 
  onEthWalletConnect 
}: NavbarProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  
  // AppKit hooks for ETH wallet
  const { open, close } = useAppKit();
  const { address: ethAddress, isConnected: isEthConnected } = useAppKitAccount();

  // Update ETH wallet connection state when AppKit state changes
  useEffect(() => {
    onEthWalletConnect(isEthConnected);
  }, [isEthConnected, onEthWalletConnect]);

  // Helper function to get wallet status and display
  const getWalletStatus = () => {
    if (requiredWalletType === 'ethereum') {
      return {
        isConnected: isEthConnected,
        walletType: 'Ethereum',
        address: ethAddress,
        disconnect: () => open()
      };
    } else if (requiredWalletType === 'sui') {
      return {
        isConnected: isSuiWalletConnected,
        walletType: 'Sui',
        address: currentAccount?.address,
        disconnect: () => disconnect()
      };
    }
    return null;
  };

  const walletStatus = getWalletStatus();

  // If no wallet is required, don't show wallet buttons
  if (!requiredWalletType) {
    return (
      <nav className="bg-black/30 backdrop-blur-lg border-b border-[#ffd700]/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] text-transparent bg-clip-text hover:scale-105 transition-transform cursor-pointer">
                Not1iNCH
              </span>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-black/30 backdrop-blur-lg border-b border-[#ffd700]/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] text-transparent bg-clip-text hover:scale-105 transition-transform cursor-pointer">
            Not1iNCH
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {walletStatus?.isConnected ? (
              <>
                <div className="text-sm text-green-400 bg-green-900/20 px-3 py-1 rounded-lg border border-green-500/30">
                  {walletStatus.address 
                    ? `${walletStatus.address.slice(0, 6)}...${walletStatus.address.slice(-4)}`
                    : `${walletStatus.walletType} Connected`
                  }
                </div>
                <button
                  onClick={walletStatus.disconnect}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className="group relative px-6 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 hover:scale-105"
                >
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500 to-red-600 opacity-50 blur-lg transition-opacity duration-300 group-hover:opacity-100"></span>
                  <span className="relative flex items-center">
                    <WalletIcon className={`h-5 w-5 mr-2 transition-transform duration-300 ${isHovering ? 'rotate-12' : ''}`} />
                    Disconnect
                  </span>
                </button>
              </>
            ) : (
              <>
                {requiredWalletType === 'ethereum' ? (
                  // ETH wallet connect button using AppKit web component
                  <div className="connect-button-wrapper">
                    <ConnectButton />
                  </div>
                ) : (
                  // Sui wallet connect button
                  <button
                    onClick={() => setConnectModalOpen(true)}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className="group relative px-6 py-2 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] text-black font-bold hover:shadow-lg hover:shadow-[#ffd700]/20 transition-all duration-300 hover:scale-105"
                  >
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] opacity-50 blur-lg transition-opacity duration-300 group-hover:opacity-100"></span>
                    <span className="relative flex items-center">
                      <WalletIcon className={`h-5 w-5 mr-2 transition-transform duration-300 ${isHovering ? 'rotate-12' : ''}`} />
                      Connect Sui Wallet
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sui Connect Modal */}
      {requiredWalletType === 'sui' && (
        <ConnectModal
          trigger={<div style={{ display: 'none' }} />}
          open={connectModalOpen}
          onOpenChange={(isOpen) => setConnectModalOpen(isOpen)}
        />
      )}
      
      {/* Custom styles for ETH wallet button */}
      <style jsx>{`
        .connect-button-wrapper :global(appkit-button) {
          --w3m-color-mix: #ffd700;
          --w3m-accent: #ffd700;
          --w3m-border-radius-master: 12px;
        }
        
        .connect-button-wrapper :global(appkit-button > w3m-button) {
          background: linear-gradient(135deg, #ffd700, #ffed4a, #ffd700) !important;
          color: black !important;
          font-weight: bold !important;
          padding: 8px 24px !important;
          border-radius: 12px !important;
          border: none !important;
          transition: all 0.3s ease !important;
        }
        
        .connect-button-wrapper :global(appkit-button > w3m-button:hover) {
          transform: scale(1.05) !important;
          box-shadow: 0 10px 25px rgba(255, 215, 0, 0.2) !important;
        }
      `}</style>
    </nav>
  );
}