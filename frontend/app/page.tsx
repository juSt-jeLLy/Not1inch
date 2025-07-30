'use client';

import Image from "next/image";
import { useState, useEffect } from "react";
import { ArrowRightIcon, QuestionMarkCircleIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import Navbar from "./components/Navbar";

const tokens = [
  { 
    id: 'eth', 
    name: 'ETH', 
    fullName: 'Ethereum', 
    icon: '/icons/eth.svg', 
    network: 'ETHEREUM NETWORK',
    price: '$2,439.41'
  },
  { 
    id: 'sui', 
    name: 'SUI', 
    fullName: 'Sui', 
    icon: '/icons/Sui_Symbol_Sea.svg', 
    network: 'SUI NETWORK',
    price: '$1.85'
  },
  { 
    id: 'monad', 
    name: 'MONAD', 
    fullName: 'Monad', 
    icon: '/icons/monad.svg', 
    network: 'MONAD NETWORK',
    price: '$0.05'
  }
];

export default function Home() {
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [amount, setAmount] = useState('');
  const [selectedRate, setSelectedRate] = useState('variable');
  const [receivingAddress, setReceivingAddress] = useState('');
  const [currentRate, setCurrentRate] = useState('0.0000');
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  useEffect(() => {
    setCurrentRate((Math.random() * 0.1).toFixed(4));
    const interval = setInterval(() => {
      setCurrentRate((Math.random() * 0.1).toFixed(4));
    }, 30000);
    return () => clearInterval(interval);
  }, [fromToken.id, toToken.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] via-[#242424] to-[#1a1a1a] text-white font-mono">
      <Navbar 
        isWalletConnected={isWalletConnected}
        onWalletConnect={setIsWalletConnected}
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
                <span className="text-[#ffd700] animate-pulse">
                  1 {fromToken.name} ≈ {currentRate} {toToken.name}
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
                <div className="bg-[#ffd700]/10 text-sm px-4 py-2 rounded-lg text-[#ffd700] group-hover:bg-[#ffd700]/20 transition-all duration-300">
                  {fromToken.network}
                </div>
              </div>

              {/* Arrow */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="relative bg-black/50 rounded-full p-3 border border-[#ffd700]/20 hover:border-[#ffd700]/40 transition-all duration-300 hover:scale-110 cursor-pointer group">
                  <div className="absolute inset-0 bg-[#ffd700]/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <ArrowRightIcon className="h-6 w-6 text-[#ffd700] relative" />
                </div>
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
                <div className="bg-[#ffd700]/10 text-sm px-4 py-2 rounded-lg text-[#ffd700] group-hover:bg-[#ffd700]/20 transition-all duration-300">
                  {toToken.network}
                </div>
              </div>
            </div>

            {/* Receiving Address */}
            <div className="mb-8">
              <div className="text-gray-400 mb-2">RECEIVING ADDRESS</div>
              <div className="relative group">
                <input
                  type="text"
                  value={receivingAddress}
                  onChange={(e) => setReceivingAddress(e.target.value)}
                  placeholder={`Your ${toToken.name} address`}
                  className="w-full bg-black/50 border border-[#ffd700]/10 rounded-xl py-4 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#ffd700]/30 transition-all duration-300"
                />
                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:scale-110 transition-transform duration-300">
                  <QrCodeIcon className="h-6 w-6 text-[#ffd700]" />
                </button>
                <div className="absolute inset-0 border border-[#ffd700]/0 rounded-xl group-hover:border-[#ffd700]/20 transition-all duration-300"></div>
              </div>
            </div>

            {/* Swap Button */}
            <button
              disabled={!receivingAddress || !isWalletConnected}
              className={`relative w-full py-4 rounded-xl text-center font-bold text-lg transition-all duration-300 ${
                receivingAddress && isWalletConnected
                  ? 'bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] text-black hover:shadow-lg hover:shadow-[#ffd700]/20 hover:scale-[1.02]'
                  : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span className="relative z-10">SWAP NOW</span>
              {receivingAddress && isWalletConnected && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] opacity-50 blur-lg transition-opacity duration-300 hover:opacity-100"></div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
