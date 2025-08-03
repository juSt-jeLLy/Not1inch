"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Resolver = void 0;
var ethers_1 = require("ethers");
var Resolver_json_1 = require("../dist/contracts/Resolver.sol/Resolver.json");
var cross_chain_sdk_1 = require("@1inch/cross-chain-sdk");
var Resolver = /** @class */ (function () {
    function Resolver(srcAddress, dstAddress) {
        this.srcAddress = srcAddress;
        this.dstAddress = dstAddress;
        this.iface = this.createInterfaceWithFallback(Resolver_json_1.abi);
    }
    Resolver.prototype.createInterfaceWithFallback = function (abi) {
        var hasSweep = abi.some(function (item) {
            return item.type === 'function' && item.name === 'sweep';
        });
        if (!hasSweep) {
            console.warn('sweep function not found in ABI, adding manually');
            var sweepABI = {
                "type": "function",
                "name": "sweep",
                "inputs": [
                    { "name": "token", "type": "address", "internalType": "address" },
                    { "name": "to", "type": "address", "internalType": "address" }
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
            };
            abi = __spreadArray(__spreadArray([], abi, true), [sweepABI], false);
        }
        var hasArbitraryCalls = abi.some(function (item) {
            return item.type === 'function' && item.name === 'arbitraryCalls';
        });
        if (!hasArbitraryCalls) {
            console.warn('arbitraryCalls function not found in ABI, adding manually');
            var arbitraryCallsABI = {
                "type": "function",
                "name": "arbitraryCalls",
                "inputs": [
                    { "name": "targets", "type": "address[]", "internalType": "address[]" },
                    { "name": "arguments", "type": "bytes[]", "internalType": "bytes[]" }
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
            };
            abi = __spreadArray(__spreadArray([], abi, true), [arbitraryCallsABI], false);
        }
        return new ethers_1.Interface(abi);
    };
    Resolver.prototype.deploySrc = function (chainId, order, signature, takerTraits, amount, hashLock) {
        if (hashLock === void 0) { hashLock = order.escrowExtension.hashLockInfo; }
        var _a = ethers_1.Signature.from(signature), r = _a.r, vs = _a.yParityAndS;
        var _b = takerTraits.encode(), args = _b.args, trait = _b.trait;
        var immutables = order.toSrcImmutables(chainId, new cross_chain_sdk_1.Address(this.srcAddress), amount, hashLock);
        return {
            to: this.srcAddress,
            data: this.iface.encodeFunctionData('deploySrc', [
                immutables.build(),
                order.build(),
                r,
                vs,
                amount,
                trait,
                args
            ]),
            value: order.escrowExtension.srcSafetyDeposit
        };
    };
    Resolver.prototype.deployDst = function (immutables, srcCancellationTimestamp) {
        var cancellationTimestamp = srcCancellationTimestamp ||
            immutables.timeLocks.toSrcTimeLocks().privateCancellation;
        return {
            to: this.dstAddress,
            data: this.iface.encodeFunctionData('deployDst', [
                immutables.build(),
                cancellationTimestamp
            ]),
            value: immutables.safetyDeposit
        };
    };
    Resolver.prototype.withdraw = function (side, escrow, secret, immutables) {
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: this.iface.encodeFunctionData('withdraw', [escrow.toString(), secret, immutables.build()])
        };
    };
    Resolver.prototype.cancel = function (side, escrow, immutables) {
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress,
            data: this.iface.encodeFunctionData('cancel', [escrow.toString(), immutables.build()])
        };
    };
    // ✅ FIXED: Add side parameter to determine which contract to sweep from
    Resolver.prototype.sweep = function (token, to, side) {
        if (side === void 0) { side = 'dst'; }
        return {
            to: side === 'src' ? this.srcAddress : this.dstAddress, // ✅ Use correct address based on side
            data: this.iface.encodeFunctionData('sweep', [token, to])
        };
    };
    Resolver.prototype.arbitraryCalls = function (targets, calldata) {
        return {
            to: this.dstAddress,
            data: this.iface.encodeFunctionData('arbitraryCalls', [targets, calldata])
        };
    };
    // ✅ NEW: Convenience methods for specific side sweeping
    Resolver.prototype.sweepSrc = function (token, to) {
        return this.sweep(token, to, 'src');
    };
    Resolver.prototype.sweepDst = function (token, to) {
        return this.sweep(token, to, 'dst');
    };
    return Resolver;
}());
exports.Resolver = Resolver;
