'use client';

import Image from "next/image";
import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useAppKitAccount } from '@reown/appkit/react';
import { ArrowRightIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import Navbar from "./components/Navbar";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useSignTransaction } from "@mysten/dapp-kit";
import { useSuiClient } from "@mysten/dapp-kit";
import {uint8ArrayToHex, UINT_40_MAX} from '@1inch/byte-utils'
import { randomBytes, Result } from "ethers";
import { SDK, HashLock } from "@1inch/cross-chain-sdk";
import { keccak256, toUtf8Bytes } from "ethers";
import {auctionTick, fillStandardOrder, addSafetyDeposit, announceStandardOrder} from '../../../sui/clientpartial'

import {FINALITY_LOCK_DURATION_MS, RESOLVER_CANCELLATION_DURATION_MS, RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS, MAKER_CANCELLATION_DURATION_MS, PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS} from "./func/suitoevm"

// Hardcoded configuration
const SUI_PACKAGE_ID = "0x14e9f86c5e966674e6dbb28545bbff2052e916d93daba5729dbc475b1b336bb4";
const resolverAddress = "0x8acfda09209247fd73805b2e2fce19d1400d148ea38bdb9237f15925593eff27";

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

function hexToU8Vector(hexString: string): number[] {
    return Array.from(Buffer.from(hexString.slice(2), 'hex'));
}

export default function Home() {
const [fromToken, setFromToken] = useState(tokens[0]);
const [toToken, setToToken] = useState(tokens[1]);
const [selectedRate, setSelectedRate] = useState('variable');
const [receivingAddress, setReceivingAddress] = useState('');
const [fromAmount, setFromAmount] = useState('');
const [toAmount, setToAmount] = useState('');
const [lastEditedField, setLastEditedField] = useState('from');
const [isSwapping, setIsSwapping] = useState(false);
const [swapStatus, setSwapStatus] = useState('');

// Sui wallet state
const currentAccount = useCurrentAccount();
const isSuiWalletConnected = !!currentAccount;
const suiClient = useSuiClient();
const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
		execute: async ({ bytes, signature }) =>
			await suiClient.executeTransactionBlock({
				transactionBlock: bytes,
				signature,
				options: {
					// Raw effects are required so the effects can be reported back to the wallet
					showRawEffects: true,
					// Select additional data to return
					showObjectChanges: true,
				},
			}),
	});

// ETH wallet state from AppKit
const { address: ethAddress, isConnected: isEthConnected } = useAppKitAccount();

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

const isWalletConnectionValid = () => {
  if (fromToken.id === 'usdc') {
    return isEthConnected; // USDC uses Ethereum wallets
  } else if (fromToken.id === 'sui') {
    return isSuiWalletConnected;
  } else {
    return true; // No wallet required for other tokens
  }
};

const getRequiredWalletType = () => {
  if (fromToken.id === 'usdc') return 'ethereum';
  if (fromToken.id === 'sui') return 'sui';
  return null;
};

// Complete swap implementation following the test file exactly
const handleSwapNow = async () => {
  if (isSwapping) return;
  
  setIsSwapping(true);
  setSwapStatus('Starting swap...');

  try {
    const swapData = {
      fromToken: {
        id: fromToken.id,
        name: fromToken.name,
        fullName: fromToken.fullName,
        network: fromToken.network,
        amount: fromAmount,
      },
      toToken: {
        id: toToken.id,
        name: toToken.name,
        fullName: toToken.fullName,
        network: toToken.network,
        amount: toAmount,
      },
      receivingAddress: receivingAddress,
      exchangeRate: getCurrentRate(),
      walletConnected: {
        sui: isSuiWalletConnected ? currentAccount?.address : null,
        arbitrum: isEthConnected ? ethAddress : null,
      },
      timestamp: new Date().toISOString(),
      rateType: selectedRate,
    };

    console.log("Swap Data:", swapData);

    // Generate secret and order hash exactly like in test
    const secret = uint8ArrayToHex(randomBytes(32));
    const orderHash = uint8ArrayToHex(randomBytes(32));
    const hashLock = HashLock.forSingleFill(secret);
    const hash = hashLock.toString();
    const secretHash = hexToU8Vector(keccak256(toUtf8Bytes(hash)));

    console.log("🔐 Generated secret:", secret);
    console.log("📋 Generated order hash:", orderHash);
    console.log("🔒 Hash lock:", hash);

    // Step 1: Announce Order
    setSwapStatus('Announcing order on Sui...');
    const txAnnounceOrder = new Transaction();

    txAnnounceOrder.moveCall({
      target: `${SUI_PACKAGE_ID}::htlc::announce_order`,
      typeArguments: ["0x2::sui::SUI"],
      arguments: [
        txAnnounceOrder.pure.vector("u8", secretHash),
        txAnnounceOrder.pure.u64(1_000_000_0),
        txAnnounceOrder.pure.u64(900_000_0),
        txAnnounceOrder.pure.u64(60 * 1000 * 50),
        txAnnounceOrder.object("0x6"), // clock
      ],
    });

    const createdOrderId = await new Promise<string | undefined>((resolve, reject) => {
      signAndExecuteTransaction(
        {
          transaction: txAnnounceOrder,
          chain: "sui:testnet",
        },
        {
          onSuccess: (result) => {
            const created = result.objectChanges?.find(
              (change) => change.type === "created"
            )?.objectId;
            console.log("✅ Order ID created:", created);
            resolve(created);
          },
          onError: (err) => {
            console.error("❌ Failed to announce order:", err);
            reject(err);
          },
        }
      );
    });

    if (!createdOrderId) {
      throw new Error("Failed to create order");
    }

    // Step 2: Auction Tick
    setSwapStatus('Processing auction tick...');
    const auctionTickRes = await auctionTick(createdOrderId);
    console.log("✅ Auction Tick Result:", auctionTickRes);

    // Step 3: Fill Order
    setSwapStatus('Filling order on Sui...');
    const fillOrderRes = await fillStandardOrder(createdOrderId);
    console.log("✅ Order filled on Sui chain:", fillOrderRes);

    // Step 4: Create HTLC
    setSwapStatus('Creating HTLC on Sui...');
    const tx = new Transaction();
    const [htlcCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(50_000_000)]);

    tx.moveCall({
      target: `${SUI_PACKAGE_ID}::htlc::create_htlc_escrow_src`,
      typeArguments: ["0x2::sui::SUI"],
      arguments: [
        tx.object(createdOrderId),
        tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }),
        tx.pure.vector("u8", secretHash),
        tx.pure.u64(FINALITY_LOCK_DURATION_MS),
        tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
        tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
        tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
        tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
        tx.pure.address(resolverAddress),
        tx.object("0x6"), // clock
      ],
    });

    const htlcId = await new Promise<string | undefined>((resolve, reject) => {
      signAndExecuteTransaction(
        {
          transaction: tx,
          chain: "sui:testnet",
        },
        {
          onSuccess: (result) => {
            const created = result.objectChanges?.find(
              (change) => change.type === "created"
            )?.objectId;
            console.log("✅ HTLC Source Created:", created);
            resolve(created);
          },
          onError: (err) => {
            console.error("❌ Failed to create HTLC:", err);
            reject(err);
          },
        }
      );
    });

    if (!htlcId) {
      throw new Error("Failed to create HTLC");
    }

    console.log("✅ HTLC Source created successfully!");

    // Step 5: Execute destination chain swap via API (following test logic exactly)
    setSwapStatus('Executing destination chain swap...');
    console.log("🚀 Calling API to execute destination chain swap...");
    
    const response = await fetch('./api/execute-swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secret,
        orderHash: orderHash,
        htlcId: htlcId,
        amount: fromAmount
      }),
    });

    const apiResult = await response.json();
    console.log("🔄 API Response:", apiResult);

    if (apiResult.success) {
      setSwapStatus('Swap completed successfully!');
      console.log("✅ Complete cross-chain swap successful:", apiResult.data);
      
      // Show detailed success message
      const successMessage = `🎉 Cross-Chain Swap Completed Successfully!

📊 Swap Details:
• From: ${fromAmount} ${fromToken.name} (${fromToken.network})
• To: ${toAmount} ${toToken.name} (${toToken.network})
• Exchange Rate: 1 ${fromToken.name} = ${getCurrentRate()} ${toToken.name}

🔗 Transaction Details:
• Sui HTLC ID: ${htlcId}
• Destination Escrow: ${apiResult.data.dstEscrowAddress}
• Destination Tx: ${apiResult.data.txHash}

✅ Your ${toToken.name} tokens are now available at: ${receivingAddress}`;

      alert(successMessage);
      
      // Reset form
      setFromAmount('');
      setToAmount('');
      setReceivingAddress('');
      
    } else {
      throw new Error(apiResult.error || 'Destination swap failed');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("❌ Swap failed:", error);
    setSwapStatus(`Swap failed: ${errorMessage}`);
    alert(`❌ Swap Failed: ${errorMessage}`);
  } finally {
    setIsSwapping(false);
    // Clear status after 5 seconds
    setTimeout(() => setSwapStatus(''), 5000);
  }
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