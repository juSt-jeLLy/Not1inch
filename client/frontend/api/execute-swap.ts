// pages/api/execute-swap.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { executeDestinationSwap, SwapParams } from '../shared/swap-logic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Set CORS headers for cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false,
            error: 'Method not allowed. Use POST.' 
        });
    }

    console.log('🚀 API route /api/execute-swap called');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    try {
        const { secret, orderHash, htlcId, amount } = req.body;

        // Validate required parameters
        if (!secret || !orderHash || !htlcId) {
            console.error('❌ Missing required parameters');
            return res.status(400).json({ 
                success: false,
                error: 'Missing required parameters. Need: secret, orderHash, htlcId',
                received: {
                    secret: !!secret,
                    orderHash: !!orderHash,
                    htlcId: !!htlcId,
                    amount: !!amount
                }
            });
        }

        console.log('📝 Parameters validated successfully');
        console.log('Secret length:', secret.length);
        console.log('Order hash length:', orderHash.length);
        console.log('HTLC ID:', htlcId);
        console.log('Amount:', amount || '99 (default)');

        // Prepare swap parameters
        const swapParams: SwapParams = {
            secret,
            orderHash,
            htlcId,
            amount: amount || '99' // Default to 99 USDC
        };

        console.log('🔄 Starting destination swap execution...');
        console.log('Swap params:', {
            ...swapParams,
            secret: swapParams.secret.substring(0, 10) + '...' // Hide full secret in logs
        });

        // Execute the destination swap
        const startTime = Date.now();
        const result = await executeDestinationSwap(swapParams);
        const executionTime = Date.now() - startTime;

        console.log(`⏱️ Swap execution took ${executionTime}ms`);

        if (result.success) {
            console.log('✅ Destination swap completed successfully');
            console.log('Result:', {
                dstEscrowAddress: result.dstEscrowAddress,
                txHash: result.txHash
            });

            res.status(200).json({
                success: true,
                message: 'Cross-chain swap completed successfully! 🎉',
                data: {
                    dstEscrowAddress: result.dstEscrowAddress,
                    txHash: result.txHash,
                    htlcId,
                    secret: secret.substring(0, 10) + '...', // Only show first 10 chars for security
                    executionTimeMs: executionTime,
                    timestamp: new Date().toISOString(),
                    network: 'Arbitrum Sepolia',
                    amount: swapParams.amount + ' USDC'
                }
            });
        } else {
            console.error('❌ Destination swap failed:', result.error);
            res.status(500).json({
                success: false,
                error: result.error || 'Unknown error occurred during swap execution',
                htlcId,
                executionTimeMs: executionTime,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('💥 API route error:', error);
        
        // Detailed error logging
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }

        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
            timestamp: new Date().toISOString(),
            details: 'Check server logs for more information'
        });
    }
}