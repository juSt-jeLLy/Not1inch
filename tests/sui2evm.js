"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPLOYED_CONTRACTS = void 0;
exports.getProvider = getProvider;
require("dotenv/config");
require("./config");
var cross_chain_sdk_1 = require("@1inch/cross-chain-sdk");
var cross_chain_sdk_2 = require("@1inch/cross-chain-sdk");
var ethers_1 = require("ethers");
var byte_utils_1 = require("@1inch/byte-utils");
var config_1 = require("./config");
var wallet_1 = require("./wallet");
var resolversui_1 = require("./resolversui");
var escrow_factory_1 = require("./escrow-factory");
var Resolver_json_1 = require("../dist/contracts/Resolver.sol/Resolver.json");
var ed25519_1 = require("@mysten/sui/keypairs/ed25519");
// const { Address, HashLock, TimeLocks, Immutables } = Sdk
exports.DEPLOYED_CONTRACTS = {
    escrowFactory: '0xfde41A17EBfA662867DA7324C0Bf5810623Cb3F8',
    resolver: '0x1Ae0817d98a8A222235A2383422e1A1c03d73e3a'
};
var userPk = '0x38c4aadf07a344bd5f5baedc7b43f11a9b863cdd16242f3b94a53541ad19fedc';
var resolverPk = '0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66';
var SUI_PRIVATE_KEY_RESOLVER = process.env.SUI_PRIVATE_KEY_RESOLVER;
var suiKeypairResolver = ed25519_1.Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_RESOLVER, 'hex'));
var suiAddressResolver = suiKeypairResolver.getPublicKey().toSuiAddress();
function increaseTime(t, provider) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, provider.send('evm_increaseTime', [t])];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, provider.send('evm_mine', [])];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function initChain(cnf) {
    return __awaiter(this, void 0, void 0, function () {
        var provider;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getProvider(cnf)];
                case 1:
                    provider = (_a.sent()).provider;
                    return [2 /*return*/, {
                            provider: provider,
                            escrowFactory: exports.DEPLOYED_CONTRACTS.escrowFactory,
                            resolver: exports.DEPLOYED_CONTRACTS.resolver
                        }];
            }
        });
    });
}
function getProvider(cnf) {
    return __awaiter(this, void 0, void 0, function () {
        var provider;
        return __generator(this, function (_a) {
            provider = new ethers_1.JsonRpcProvider(cnf.url, cnf.chainId, {
                cacheTimeout: -1,
                staticNetwork: true
            });
            return [2 /*return*/, { provider: provider }];
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var srcChainId, dstChainId, dst, dstChainUser, dstChainResolver, dstFactory, usdcInterface, resolverInstance, approveCalldata, resolverInterface, secret, hashLock, orderHash, hash, currentTime, timeLocks, dstImmutables, _a, _b, _c, _d, dstDepositHash, dstDeployedAt, dstImplementation, escrowFactory, dstEscrowAddress, resolverEOA;
        var _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    srcChainId = config_1.config.chain.source.chainId;
                    dstChainId = config_1.config.chain.destination.chainId;
                    return [4 /*yield*/, initChain(config_1.config.chain.destination)];
                case 1:
                    dst = _f.sent();
                    dstChainUser = new wallet_1.Wallet(userPk, dst.provider);
                    dstChainResolver = new wallet_1.Wallet(resolverPk, dst.provider);
                    dstFactory = new escrow_factory_1.EscrowFactory(dst.provider, dst.escrowFactory);
                    return [4 /*yield*/, dstChainResolver.transfer(dst.resolver, (0, ethers_1.parseEther)('0.0001'))];
                case 2:
                    _f.sent();
                    return [4 /*yield*/, dstChainResolver.transferToken(config_1.config.chain.destination.tokens.USDC.address, dst.resolver, (0, ethers_1.parseUnits)('0.1', 6))];
                case 3:
                    _f.sent();
                    usdcInterface = new ethers_1.Interface([
                        'function approve(address spender, uint256 amount) returns (bool)'
                    ]);
                    resolverInstance = new resolversui_1.Resolver(dst.resolver, dst.resolver);
                    approveCalldata = usdcInterface.encodeFunctionData('approve', [dst.escrowFactory, ethers_1.MaxUint256]);
                    resolverInterface = new ethers_1.Interface(Resolver_json_1.abi);
                    return [4 /*yield*/, dstChainResolver.send({
                            to: dst.resolver,
                            data: resolverInterface.encodeFunctionData('arbitraryCalls', [
                                [config_1.config.chain.destination.tokens.USDC.address],
                                [approveCalldata]
                            ])
                        })];
                case 4:
                    _f.sent();
                    console.log('✅ Resolver contract has USDC and approved factory');
                    secret = (0, byte_utils_1.uint8ArrayToHex)((0, ethers_1.randomBytes)(32));
                    hashLock = cross_chain_sdk_2.HashLock.forSingleFill(secret);
                    orderHash = (0, byte_utils_1.uint8ArrayToHex)((0, ethers_1.randomBytes)(32));
                    hash = hashLock.toString();
                    currentTime = BigInt(Math.floor(Date.now() / 1000));
                    timeLocks = cross_chain_sdk_2.TimeLocks.new({
                        srcWithdrawal: 2n,
                        srcPublicWithdrawal: 3600n,
                        srcCancellation: 7200n,
                        srcPublicCancellation: 7260n,
                        dstWithdrawal: 5n,
                        dstPublicWithdrawal: 1800n,
                        dstCancellation: 3600n
                    }).setDeployedAt(currentTime);
                    _b = (_a = cross_chain_sdk_2.Immutables).new;
                    _e = {
                        orderHash: orderHash,
                        hashLock: hashLock
                    };
                    _c = cross_chain_sdk_2.Address.bind;
                    return [4 /*yield*/, dstChainUser.getAddress()];
                case 5:
                    dstImmutables = _b.apply(_a, [(_e.maker = new (_c.apply(cross_chain_sdk_2.Address, [void 0, _f.sent()]))(),
                            _e.taker = new cross_chain_sdk_2.Address(dst.resolver),
                            _e.token = new cross_chain_sdk_2.Address(config_1.config.chain.destination.tokens.USDC.address),
                            _e.amount = (0, ethers_1.parseUnits)('0.1', 6),
                            _e.safetyDeposit = (0, ethers_1.parseEther)('0.00001'),
                            _e.timeLocks = timeLocks,
                            _e)]);
                    if (timeLocks.toDstTimeLocks().privateCancellation >= timeLocks.toSrcTimeLocks().privateCancellation) {
                        throw new Error('Invalid timelock relationship');
                    }
                    console.log('Deploying destination escrow...');
                    return [4 /*yield*/, dstChainResolver.send(resolverInstance.deployDst(dstImmutables, timeLocks.toSrcTimeLocks().privateCancellation))];
                case 6:
                    _d = _f.sent(), dstDepositHash = _d.txHash, dstDeployedAt = _d.blockTimestamp;
                    console.log('Deployed escrow TX:', dstDepositHash);
                    return [4 /*yield*/, dstFactory.getDestinationImpl()];
                case 7:
                    dstImplementation = _f.sent();
                    escrowFactory = new cross_chain_sdk_1.default.EscrowFactory(new cross_chain_sdk_2.Address(dst.escrowFactory));
                    dstEscrowAddress = escrowFactory.getEscrowAddress(dstImmutables.withDeployedAt(dstDeployedAt).hash(), dstImplementation);
                    console.log('Escrow Address:', dstEscrowAddress.toString());
                    console.log('Waiting for timelock...');
                    return [4 /*yield*/, increaseTime(10, dst.provider)];
                case 8:
                    _f.sent();
                    console.log('Withdrawing from destination escrow...');
                    return [4 /*yield*/, dstChainResolver.send(resolverInstance.withdraw('dst', dstEscrowAddress, secret, dstImmutables.withDeployedAt(dstDeployedAt)))];
                case 9:
                    _f.sent();
                    console.log('Claiming HTLC on Sui...');
                    return [4 /*yield*/, dstChainResolver.getAddress()];
                case 10:
                    resolverEOA = _f.sent();
                    return [4 /*yield*/, dstChainResolver.send(resolverInstance.sweepDst('0x0000000000000000000000000000000000000000', resolverEOA))];
                case 11:
                    _f.sent();
                    console.log('🎉 Cross-chain swap complete');
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error('❌ Error running script:', err);
    process.exit(1);
});
