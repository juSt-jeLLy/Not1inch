'use client';

import Image from "next/image";
import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useAppKitAccount } from '@reown/appkit/react';
import { ArrowRightIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import Navbar from "./components/Navbar";

const tokens = [
{ 
  id: 'usdc', 
  name: 'USDC', 
  fullName: 'USD Coin', 
  icon: '/icons/usdc.webp', 
  network: 'ARBITRUM NETWORK',
  price: '$1.00'
},
{ 
  id: 'sui', 
  name: 'SUI', 
  fullName: 'Sui', 
  icon: '/icons/Sui_Symbol_Sea.svg', 
  network: 'SUI NETWORK',
  price: '$1.85'
},
];

// Fixed exchange rates
const EXCHANGE_RATES = {
'usdc-to-sui': 0.1,    // 1 USDC = 0.1 SUI
'sui-to-usdc': 10      // 1 SUI = 10 USDC
};

export default function Home() {
const [fromToken, setFromToken] = useState(tokens[0]);
const [toToken, setToToken] = useState(tokens[1]);
const [selectedRate, setSelectedRate] = useState('variable');
const [receivingAddress, setReceivingAddress] = useState('');
const [fromAmount, setFromAmount] = useState('');
const [toAmount, setToAmount] = useState('');
const [lastEditedField, setLastEditedField] = useState('from');

// Sui wallet state
const currentAccount = useCurrentAccount();
const isSuiWalletConnected = !!currentAccount;

// ETH wallet state from AppKit
const { address: ethAddress, isConnected: isEthConnected } = useAppKitAccount();

// Get current exchange rate based on token pair
const getCurrentRate = () => {
  if (fromToken.id === 'usdc' && toToken.id === 'sui') {
    return EXCHANGE_RATES['usdc-to-sui'];
  } else if (fromToken.id === 'sui' && toToken.id === 'usdc') {
    return EXCHANGE_RATES['sui-to-usdc'];
  }
  return 1; // Default rate
};

// Swap function for reversing fromToken and toToken
const handleSwap = () => {
  setFromToken(toToken);
  setToToken(fromToken);
  // Also swap the amounts
  setFromAmount(toAmount);
  setToAmount(fromAmount);
};

// Calculate exchange rate and amounts
useEffect(() => {
  const rate = getCurrentRate();
  if (lastEditedField === 'from' && fromAmount && !isNaN(parseFloat(fromAmount))) {
    const calculatedToAmount = (parseFloat(fromAmount) * rate).toFixed(6);
    setToAmount(calculatedToAmount);
  } else if (lastEditedField === 'to' && toAmount && !isNaN(parseFloat(toAmount))) {
    const calculatedFromAmount = (parseFloat(toAmount) / rate).toFixed(6);
    setFromAmount(calculatedFromAmount);
  }
}, [fromToken.id, toToken.id, fromAmount, toAmount, lastEditedField]);

// Handle from amount change
const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setFromAmount(value);
  setLastEditedField('from');
  
  if (value && !isNaN(parseFloat(value))) {
    const rate = getCurrentRate();
    const calculatedToAmount = (parseFloat(value) * rate).toFixed(6);
    setToAmount(calculatedToAmount);
  } else {
    setToAmount('');
  }
};

// Handle to amount change
const handleToAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setToAmount(value);
  setLastEditedField('to');
  
  if (value && !isNaN(parseFloat(value))) {
    const rate = getCurrentRate();
    const calculatedFromAmount = (parseFloat(value) / rate).toFixed(6);
    setFromAmount(calculatedFromAmount);
  } else {
    setFromAmount('');
  }
};

// Check if wallet connection is required and available
const isWalletConnectionValid = () => {
  if (fromToken.id === 'usdc') {
    return isEthConnected; // USDC uses Ethereum wallets
  } else if (fromToken.id === 'sui') {
    return isSuiWalletConnected;
  } else {
    return true; // No wallet required for other tokens
  }
};

// Get required wallet type based on fromToken
const getRequiredWalletType = () => {
  if (fromToken.id === 'usdc') return 'ethereum';
  if (fromToken.id === 'sui') return 'sui';
  return null;
};

// Handle swap button click
const handleSwapNow = () => {
  const swapData = {
    fromToken: {
      id: fromToken.id,
      name: fromToken.name,
      fullName: fromToken.fullName,
      network: fromToken.network,
      amount: fromAmount
    },
    toToken: {
      id: toToken.id,
      name: toToken.name,
      fullName: toToken.fullName,
      network: toToken.network,
      amount: toAmount
    },
    receivingAddress: receivingAddress,
    exchangeRate: getCurrentRate(),
    walletConnected: {
      sui: isSuiWalletConnected ? currentAccount?.address : null,
      arbitrum: isEthConnected ? ethAddress : null
    },
    timestamp: new Date().toISOString(),
    rateType: selectedRate
  };

  // Log the data (you can see this in browser console)
  console.log('Swap Data:', swapData);

  // Here you can:
  // 1. Send to an API
  // sendToAPI(swapData);
  
  // 2. Pass to parent component
  // onSwap?.(swapData);
  
  // 3. Store in state management (Redux, Zustand, etc.)
  // dispatch(initiateSwap(swapData));
  
  // 4. Navigate to confirmation page
  // router.push('/confirm-swap', { state: swapData });
  
  // 5. Show confirmation modal
  // setShowConfirmModal(true);
  
  // Example: Alert for now (replace with your logic)
  alert(`Swapping ${fromAmount} ${fromToken.name} for ${toAmount} ${toToken.name}`);
};

return (
  <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] via-[#242424] to-[#1a1a1a] text-white font-mono">
    {/* Navbar */}
    <Navbar 
      requiredWalletType={getRequiredWalletType()}
      isEthWalletConnected={isEthConnected}
      isSuiWalletConnected={isSuiWalletConnected}
      onEthWalletConnect={() => {}} 
    />

    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] text-transparent bg-clip-text">
            SWAP TOKENS
          </h1> 
          <p className="text-gray-400 text-lg">
            Fast, Secure, and Direct to Your Wallet
          </p>
        </div>

        {/* Main Card */}
        <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-[#ffd700]/10 shadow-xl hover:shadow-2xl hover:shadow-[#ffd700]/10 transition-all duration-500">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#ffd700]/5 via-transparent to-[#ffd700]/5 opacity-50"></div>
          
          {/* Rate Toggle */}
          <div className="relative flex gap-8 mb-8">
            <button 
              onClick={() => setSelectedRate('variable')}
              className={`pb-2 border-b-2 transition-all duration-300 ${
                selectedRate === 'variable' 
                  ? 'border-[#ffd700] text-[#ffd700] scale-105' 
                  : 'border-transparent text-gray-500 hover:text-[#ffd700]/70'
              }`}
            >
              VARIABLE RATE
            </button>
            <button 
              onClick={() => setSelectedRate('fixed')}
              className={`pb-2 border-b-2 transition-all duration-300 ${
                selectedRate === 'fixed' 
                  ? 'border-[#ffd700] text-[#ffd700] scale-105' 
                  : 'border-transparent text-gray-500 hover:text-[#ffd700]/70'
              }`}
            >
              FIXED RATE
            </button>
            <div className="flex-grow text-right">
              <span className="text-[#ffd700] font-semibold">
                1 {fromToken.name} = {getCurrentRate()} {toToken.name}
              </span>
            </div>
          </div>

          {/* Exchange Cards */}
          <div className="relative grid grid-cols-2 gap-6 mb-8">
            {/* From Token */}
            <div className="group bg-black/50 rounded-xl p-6 border border-[#ffd700]/10 hover:border-[#ffd700]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#ffd700]/10">
              <div className="text-gray-400 mb-4">YOU SEND</div>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#ffd700]/20 rounded-full blur-md group-hover:blur-lg transition-all duration-300"></div>
                  <Image 
                    src={fromToken.icon} 
                    alt={fromToken.name} 
                    width={48} 
                    height={48}
                    className="relative transform group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#ffd700] group-hover:text-[#ffed4a] transition-colors duration-300">
                    {fromToken.name}
                  </div>
                  <div className="text-gray-400">{fromToken.fullName}</div>
                </div>
              </div>
              <div className="bg-[#ffd700]/10 text-sm px-4 py-2 rounded-lg text-[#ffd700] group-hover:bg-[#ffd700]/20 transition-all duration-300 mb-4">
                {fromToken.network}
              </div>
              {/* Amount Input */}
              <div>
                <div className="text-gray-400 text-sm mb-2">AMOUNT</div>
                <input
                  type="number"
                  value={fromAmount}
                  onChange={handleFromAmountChange}
                  placeholder="0.00"
                  className="w-full bg-black/50 border border-[#ffd700]/10 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#ffd700]/30 transition-all duration-300"
                  step="any"
                  min="0"
                />
              </div>
            </div>

            {/* Arrow */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <button
                type="button"
                onClick={handleSwap}
                className="relative bg-black/50 rounded-full p-3 border border-[#ffd700]/20 hover:border-[#ffd700]/40 transition-all duration-300 hover:scale-110 cursor-pointer group"
                aria-label="Swap tokens"
              >
                <div className="absolute inset-0 bg-[#ffd700]/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <ArrowRightIcon className="h-6 w-6 text-[#ffd700] relative" />
              </button>
            </div>

            {/* To Token */}
            <div className="group bg-black/50 rounded-xl p-6 border border-[#ffd700]/10 hover:border-[#ffd700]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#ffd700]/10">
              <div className="text-gray-400 mb-4">YOU RECEIVE</div>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#ffd700]/20 rounded-full blur-md group-hover:blur-lg transition-all duration-300"></div>
                  <Image 
                    src={toToken.icon} 
                    alt={toToken.name} 
                    width={48} 
                    height={48}
                    className="relative transform group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#ffd700] group-hover:text-[#ffed4a] transition-colors duration-300">
                    {toToken.name}
                  </div>
                  <div className="text-gray-400">{toToken.fullName}</div>
                </div>
              </div>
              <div className="bg-[#ffd700]/10 text-sm px-4 py-2 rounded-lg text-[#ffd700] group-hover:bg-[#ffd700]/20 transition-all duration-300 mb-4">
                {toToken.network}
              </div>
              {/* Amount Input */}
              <div>
                <div className="text-gray-400 text-sm mb-2">AMOUNT</div>
                <input
                  type="number"
                  value={toAmount}
                  onChange={handleToAmountChange}
                  placeholder="0.00"
                  className="w-full bg-black/50 border border-[#ffd700]/10 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#ffd700]/30 transition-all duration-300"
                  step="any"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Receiving Address */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400">RECEIVING ADDRESS</div>
            </div>
            <div className="relative group">
              <input
                type="text"
                value={receivingAddress}
                onChange={(e) => setReceivingAddress(e.target.value)}
                placeholder={`Enter ${toToken.name} address`}
                className="w-full bg-black/50 border border-[#ffd700]/10 rounded-xl py-4 px-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-[#ffd700]/30 transition-all duration-300"
              />
              <button 
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:scale-110 transition-transform duration-300"
              >
                <QrCodeIcon className="h-6 w-6 text-[#ffd700]" />
              </button>
              <div className="absolute inset-0 border border-[#ffd700]/0 rounded-xl group-hover:border-[#ffd700]/20 transition-all duration-300 pointer-events-none"></div>
            </div>
          </div>

          {/* Connection Status Display */}
          {fromToken.id === 'sui' && isSuiWalletConnected && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="text-green-400 text-sm">
                 Sui Wallet Connected: {currentAccount?.address.slice(0, 10)}...{currentAccount?.address.slice(-6)}
              </div>
            </div>
          )}

          {fromToken.id === 'usdc' && isEthConnected && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="text-green-400 text-sm">
                 Evm Wallet Connected: {ethAddress?.slice(0, 10)}...{ethAddress?.slice(-6)}
              </div>
            </div>
          )}

          {/* Wallet Connection Warning */}
          {!isWalletConnectionValid() && (
            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="text-yellow-400 text-sm">
                ⚠️ Please connect your {fromToken.name} wallet to proceed with the swap
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwapNow}
            disabled={!receivingAddress || !isWalletConnectionValid() || !fromAmount || !toAmount}
            className={`relative w-full py-4 rounded-xl text-center font-bold text-lg transition-all duration-300 ${
              receivingAddress && isWalletConnectionValid() && fromAmount && toAmount
                ? 'bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] text-black hover:shadow-lg hover:shadow-[#ffd700]/20 hover:scale-[1.02]'
                : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="relative z-10">
              {!fromAmount || !toAmount ? 'ENTER AMOUNT' : 'SWAP NOW'}
            </span>
            {receivingAddress && isWalletConnectionValid() && fromAmount && toAmount && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] opacity-50 blur-lg transition-opacity duration-300 hover:opacity-100"></div>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
);
}