"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
var zod_1 = require("zod");
var cross_chain_sdk_1 = require("@1inch/cross-chain-sdk");
var process = require("node:process");
var bool = zod_1.z
    .string()
    .transform(function (v) { return v.toLowerCase() === 'true'; })
    .pipe(zod_1.z.boolean());
var ConfigSchema = zod_1.z.object({
    SRC_CHAIN_RPC: zod_1.z.string().url(),
    DST_CHAIN_RPC: zod_1.z.string().url(),
    SRC_CHAIN_CREATE_FORK: bool.default('false'),
    DST_CHAIN_CREATE_FORK: bool.default('false')
});
var fromEnv = ConfigSchema.parse(process.env);
exports.config = {
    chain: {
        source: {
            chainId: cross_chain_sdk_1.NetworkEnum.ETHEREUM,
            url: fromEnv.SRC_CHAIN_RPC,
            createFork: fromEnv.SRC_CHAIN_CREATE_FORK,
            limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            ownerPrivateKey: '0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66',
            tokens: {
                USDC: {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    donor: '0xd54F23BE482D9A58676590fCa79c8E43087f92fB'
                }
            }
        },
        destination: {
            chainId: cross_chain_sdk_1.NetworkEnum.ARBITRUM,
            url: fromEnv.DST_CHAIN_RPC,
            createFork: fromEnv.DST_CHAIN_CREATE_FORK,
            limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            wrappedNative: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            ownerPrivateKey: '0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66',
            tokens: {
                USDC: {
                    address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
                    donor: '0x4188663a85C92EEa35b5AD3AA5cA7CeB237C6fe9'
                }
            }
        }
    }
};
