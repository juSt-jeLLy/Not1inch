'use client';

import { useState } from 'react';
import { WalletIcon } from "@heroicons/react/24/outline";
import { ConnectModal, useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";

interface NavbarProps {
  isWalletConnected: boolean;
  onWalletConnect: (connected: boolean) => void;
}

export default function Navbar({ isWalletConnected, onWalletConnect }: NavbarProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const isSuiWalletConnected = !!currentAccount;

  return (
    <nav className="bg-black/30 backdrop-blur-lg border-b border-[#ffd700]/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] text-transparent bg-clip-text hover:scale-105 transition-transform cursor-pointer">
              3INCH
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {isSuiWalletConnected ? (
              <>
                <div className="text-sm text-green-400 bg-green-900/20 px-3 py-1 rounded-lg border border-green-500/30">
                  {currentAccount?.address.slice(0, 6)}...{currentAccount?.address.slice(-4)}
                </div>
                <button
                  onClick={() => disconnect()}
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
              <button
                onClick={() => setConnectModalOpen(true)}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="group relative px-6 py-2 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] text-black font-bold hover:shadow-lg hover:shadow-[#ffd700]/20 transition-all duration-300 hover:scale-105"
              >
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] opacity-50 blur-lg transition-opacity duration-300 group-hover:opacity-100"></span>
                <span className="relative flex items-center">
                  <WalletIcon className={`h-5 w-5 mr-2 transition-transform duration-300 ${isHovering ? 'rotate-12' : ''}`} />
                  Connect Wallet
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      <ConnectModal
        trigger={<div style={{ display: 'none' }} />}
        open={connectModalOpen}
        onOpenChange={(isOpen) => setConnectModalOpen(isOpen)}
      />
    </nav>
  );
}