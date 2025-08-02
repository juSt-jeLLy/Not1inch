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
exports.calculateExpectedSecretIndex = calculateExpectedSecretIndex;
exports.announceStandardOrder = announceStandardOrder;
exports.fillStandardOrder = fillStandardOrder;
exports.createHTLCDst = createHTLCDst;
exports.createHTLCSrc = createHTLCSrc;
exports.claimHTLCdst = claimHTLCdst;
exports.claimHTLCdstpartial = claimHTLCdstpartial;
exports.claimHTLCsrcpartial = claimHTLCsrcpartial;
exports.claimHTLCsrc = claimHTLCsrc;
exports.recoverHTLC = recoverHTLC;
exports.addSafetyDeposit = addSafetyDeposit;
exports.auctionTick = auctionTick;
exports.auctionTickpartial = auctionTickpartial;
exports.partialAnnounceOrder = partialAnnounceOrder;
exports.fillOrderPartial = fillOrderPartial;
exports.createHTLCSrcPartial = createHTLCSrcPartial;
exports.createHTLCDstPartial = createHTLCDstPartial;
var client_1 = require("@mysten/sui/client");
var ed25519_1 = require("@mysten/sui/keypairs/ed25519");
var transactions_1 = require("@mysten/sui/transactions");
var dotenv_1 = require("dotenv");
var ethers_1 = require("ethers"); // Using ethers for keccak256
var cross_chain_sdk_1 = require("@1inch/cross-chain-sdk");
(0, dotenv_1.config)();
// const SUI_PRIVATE_KEY_RESOLVER = process.env.SUI_PRIVATE_KEY_RESOLVER!;
// const SUI_PRIVATE_KEY_USER = process.env.SUI_PRIVATE_KEY_USER!;
var SUI_PRIVATE_KEY_RESOLVER = "e3cbc98f1be6f9caf78c2fb3ba2a19de1e49fdc4f05ddd082e37a18ef5252918";
var SUI_PRIVATE_KEY_USER = "1d6b12793508282886435d5896c1898c1f05e744f64c8c9faeac1bdfdc1b5105";
var SUI_PACKAGE_ID = "0x14e9f86c5e966674e6dbb28545bbff2052e916d93daba5729dbc475b1b336bb4";
// const SUI_PACKAGE_ID  = process.env.SUI_PACKAGE_ID!;
var suiClient = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('testnet') });
var suiKeypairResolver = ed25519_1.Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_RESOLVER, 'hex'));
var suiAddressResolver = suiKeypairResolver.getPublicKey().toSuiAddress();
var suiKeypairUser = ed25519_1.Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_USER, 'hex'));
var suiAddressUser = suiKeypairUser.getPublicKey().toSuiAddress();
// --- Constants for Timelock Durations (in milliseconds) ---
// These are example durations. Adjust as needed for your testing.
var FINALITY_LOCK_DURATION_MS = 10 * 10; // 10 seconds
var RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS = 20 * 10000; // 20 seconds after finality lock
var RESOLVER_CANCELLATION_DURATION_MS = 30 * 1000; // 30 seconds after finality lock
var MAKER_CANCELLATION_DURATION_MS = 60 * 1000; // 60 seconds after finality lock
var PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS = 15 * 1000; // 15 seconds after exclusive unlock expires
// Helper function to replicate Move contract's _isValidPartialFill logic for index calculation
function calculateExpectedSecretIndex(totalOrderAmount, remainingAmount, fillAmount, partsCount) {
    var currentFilledAmount = totalOrderAmount - remainingAmount;
    var newFilledAmount = currentFilledAmount + fillAmount;
    // the core logic from Move contract's fill_order_partial for expected_index
    var targetPercentageNumerator = newFilledAmount * (partsCount + 1);
    var targetPercentageDenominator = totalOrderAmount;
    var expectedIndex = Math.floor(targetPercentageNumerator / targetPercentageDenominator); // Using Math.floor for integer division
    if (targetPercentageNumerator % targetPercentageDenominator !== 0) {
        expectedIndex = expectedIndex + 1;
    }
    return expectedIndex;
}
// // --- Helper for converting hex string to u8 vector for Move ---
function hexToU8Vector(hexString) {
    return Array.from(Buffer.from(hexString.slice(2), 'hex'));
}
// --- ANNOUNCE ORDER (STANDARD - FOR FULL FILLS) ---
function announceStandardOrder(secretPreimage) {
    return __awaiter(this, void 0, void 0, function () {
        var txAnnounceOrder, secretHash, res, orderId;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    txAnnounceOrder = new transactions_1.Transaction();
                    secretHash = hexToU8Vector((0, ethers_1.keccak256)((0, ethers_1.toUtf8Bytes)(secretPreimage)));
                    txAnnounceOrder.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::announce_order"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            txAnnounceOrder.pure.vector('u8', secretHash),
                            txAnnounceOrder.pure.u64(10000000), // start_price
                            txAnnounceOrder.pure.u64(900000), // reserve_price
                            txAnnounceOrder.pure.u64(60 * 1000 * 50), // duration_ms
                            txAnnounceOrder.object('0x6'), // clock
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairUser,
                            transaction: txAnnounceOrder,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _c.sent();
                    console.log('announce_order result:', res);
                    orderId = (_b = (_a = res.objectChanges) === null || _a === void 0 ? void 0 : _a.find(function (change) { return change.type === 'created'; })) === null || _b === void 0 ? void 0 : _b.objectId;
                    return [2 /*return*/, orderId];
            }
        });
    });
}
// --- FILL ORDER (STANDARD - FOR FULL FILLS) ---
function fillStandardOrder(orderId) {
    return __awaiter(this, void 0, void 0, function () {
        var txFillOrder, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    txFillOrder = new transactions_1.Transaction();
                    txFillOrder.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::fill_order"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            txFillOrder.object(orderId), // Pass the object ID for the shared object
                            txFillOrder.pure.u64(10000000), // bid_price - Set to start_price or higher to avoid E_PRICE_TOO_LOW
                            txFillOrder.object('0x6'), // clock
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: txFillOrder,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _a.sent();
                    console.log('fill_order result:', res);
                    return [2 /*return*/, res];
            }
        });
    });
}
// --- CREATE HTLC DST (STANDARD) ---
function createHTLCDst(secretPreimage, makerAddress, originalOrderId) {
    return __awaiter(this, void 0, void 0, function () {
        var secretHash, tx, _a, htlcCoin, safetyDepositCoin, res;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    secretHash = hexToU8Vector((0, ethers_1.keccak256)((0, ethers_1.toUtf8Bytes)(secretPreimage)));
                    tx = new transactions_1.Transaction();
                    _a = tx.splitCoins(tx.gas, [
                        tx.pure.u64(50000000), // Example amount for HTLC
                        tx.pure.u64(10000000), // Example safety deposit
                    ]), htlcCoin = _a[0], safetyDepositCoin = _a[1];
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::create_htlc_escrow_dst"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }), // coins: vector<Coin<T>>
                            tx.object(safetyDepositCoin), // safety_deposit_coin
                            tx.pure.vector('u8', secretHash), // secret_hash
                            tx.pure.u64(FINALITY_LOCK_DURATION_MS),
                            tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
                            tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
                            tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
                            tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
                            tx.pure.address(makerAddress), // maker_address
                            tx.pure.address(suiAddressResolver), // resolver_address (caller)
                            tx.object(originalOrderId), // original_order_id
                            tx.object('0x6'), // clock
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _d.sent();
                    console.log('create_htlc_escrow_dst result:', res);
                    return [2 /*return*/, (_c = (_b = res.objectChanges) === null || _b === void 0 ? void 0 : _b.find(function (change) { return change.type === 'created'; })) === null || _c === void 0 ? void 0 : _c.objectId];
            }
        });
    });
}
// --- CREATE HTLC SRC (STANDARD) ---
function createHTLCSrc(secretPreimage, orderId, resolverAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var secretHash, tx, htlcCoin, res;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    secretHash = hexToU8Vector((0, ethers_1.keccak256)((0, ethers_1.toUtf8Bytes)(secretPreimage)));
                    tx = new transactions_1.Transaction();
                    htlcCoin = tx.splitCoins(tx.gas, [
                        tx.pure.u64(50000000)
                    ])[0];
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::create_htlc_escrow_src"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(orderId),
                            tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }),
                            tx.pure.vector('u8', secretHash),
                            tx.pure.u64(FINALITY_LOCK_DURATION_MS),
                            tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
                            tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
                            tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
                            tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
                            tx.pure.address(resolverAddress),
                            tx.object('0x6'), // clock
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairUser,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _c.sent();
                    console.log("createHTLCSrc result:", res);
                    return [2 /*return*/, (_b = (_a = res.objectChanges) === null || _a === void 0 ? void 0 : _a.find(function (change) { return change.type === 'created'; })) === null || _b === void 0 ? void 0 : _b.objectId];
            }
        });
    });
}
// --- CLAIM HTLC ---
function claimHTLCdst(htlcId, secretPreimage) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, hashLock, hash, secretPreimageNumberArray, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Attempting to claim HTLC ID:', htlcId);
                    tx = new transactions_1.Transaction();
                    hashLock = cross_chain_sdk_1.default.HashLock.forSingleFill(secretPreimage);
                    hash = hashLock.toString();
                    secretPreimageNumberArray = Array.from((0, ethers_1.toUtf8Bytes)(hash));
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::claim_htlc"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(htlcId),
                            tx.pure.vector('u8', secretPreimageNumberArray),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _a.sent();
                    console.log('claim_htlc result:', res);
                    return [2 /*return*/, res];
            }
        });
    });
}
function claimHTLCdstpartial(htlcId, secretPreimage) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, leaves, hashLock, hash, secretPreimageNumberArray, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Attempting to claim HTLC ID:', htlcId);
                    tx = new transactions_1.Transaction();
                    leaves = cross_chain_sdk_1.default.HashLock.getMerkleLeaves(secretPreimage);
                    hashLock = cross_chain_sdk_1.default.HashLock.forMultipleFills(leaves);
                    hash = hashLock.toString();
                    secretPreimageNumberArray = Array.from((0, ethers_1.toUtf8Bytes)(hash));
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::claim_htlc"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(htlcId),
                            tx.pure.vector('u8', secretPreimageNumberArray),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairUser,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _a.sent();
                    console.log('claim_htlc result:', res);
                    return [2 /*return*/, res];
            }
        });
    });
}
function claimHTLCsrcpartial(htlcId, secretPreimage) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, leaves, hashLock, hash, secretPreimageNumberArray, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Attempting to claim HTLC ID:', htlcId);
                    tx = new transactions_1.Transaction();
                    leaves = cross_chain_sdk_1.default.HashLock.getMerkleLeaves(secretPreimage);
                    hashLock = cross_chain_sdk_1.default.HashLock.forMultipleFills(leaves);
                    hash = hashLock.toString();
                    secretPreimageNumberArray = Array.from((0, ethers_1.toUtf8Bytes)(hash));
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::claim_htlc"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(htlcId),
                            tx.pure.vector('u8', secretPreimageNumberArray),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _a.sent();
                    console.log('claim_htlc result:', res);
                    return [2 /*return*/, res];
            }
        });
    });
}
function claimHTLCsrc(htlcId, secretPreimage) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, hashLock, hash, secretPreimageNumberArray, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Attempting to claim HTLC ID:', htlcId);
                    tx = new transactions_1.Transaction();
                    hashLock = cross_chain_sdk_1.default.HashLock.forSingleFill(secretPreimage);
                    hash = hashLock.toString();
                    secretPreimageNumberArray = Array.from((0, ethers_1.toUtf8Bytes)(hash));
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::claim_htlc"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(htlcId),
                            tx.pure.vector('u8', secretPreimageNumberArray),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _a.sent();
                    console.log('claim_htlc result:', res);
                    return [2 /*return*/, res];
            }
        });
    });
}
// --- RECOVER HTLC ---
function recoverHTLC(htlcId) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Attempting to recover HTLC ID:', htlcId);
                    tx = new transactions_1.Transaction();
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::recover_htlc_escrow"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(htlcId),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairUser,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _a.sent();
                    console.log('recover_htlc_escrow result:', res);
                    return [2 /*return*/, res];
            }
        });
    });
}
// --- ADD SAFETY DEPOSIT ---
function addSafetyDeposit(htlcId) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, depositCoin, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tx = new transactions_1.Transaction();
                    depositCoin = tx.splitCoins(tx.gas, [
                        tx.pure.u64(10000000),
                    ])[0];
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::add_safety_deposit"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(htlcId),
                            tx.object(depositCoin),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: {
                                showEffects: true,
                                showObjectChanges: true,
                            },
                        })];
                case 1:
                    result = _a.sent();
                    console.log('add_safety_deposit result:', result);
                    return [2 /*return*/, result];
            }
        });
    });
}
// --- AUCTION TICK ---
function auctionTick(orderId) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, res, evt;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    tx = new transactions_1.Transaction();
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::auction_tick"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(orderId),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: { showEffects: true, showEvents: true },
                        })];
                case 1:
                    res = _c.sent();
                    evt = (_a = res.events) === null || _a === void 0 ? void 0 : _a.find(function (e) { return e.type.endsWith('AuctionTickEvent'); });
                    return [2 /*return*/, (_b = evt === null || evt === void 0 ? void 0 : evt.parsedJson) === null || _b === void 0 ? void 0 : _b.current_price];
            }
        });
    });
}
function auctionTickpartial(orderId) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, res, evt;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    tx = new transactions_1.Transaction();
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::partial_auction_tick"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(orderId),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: { showEffects: true, showEvents: true },
                        })];
                case 1:
                    res = _c.sent();
                    evt = (_a = res.events) === null || _a === void 0 ? void 0 : _a.find(function (e) { return e.type.endsWith('AuctionTickEvent'); });
                    return [2 /*return*/, (_b = evt === null || evt === void 0 ? void 0 : evt.parsedJson) === null || _b === void 0 ? void 0 : _b.current_price];
            }
        });
    });
}
// --- PARTIAL FILL FUNCTIONS ---
// async function partialAnnounceOrder(totalAmount: number, partsCount: number, secretPreimageBase: string) {
//     const tx = new Transaction();
//     const { merkleRoot } = generateMerkleData(partsCount, secretPreimageBase);
//     tx.moveCall({
//         target: `${SUI_PACKAGE_ID}::htlc::partial_announce_order`,
//         typeArguments: ['0x2::sui::SUI'],
//         arguments: [
//             tx.pure.u64(totalAmount),
//             tx.pure.u64(1_000_000_000), // start_price
//             tx.pure.u64(900_000_000), // reserve_price
//             tx.pure.u64(60 * 1000), // duration_ms
//             tx.pure.u64(partsCount),
//             tx.pure.vector('u8', merkleRoot), // Send the actual root
//             tx.object('0x6'), // clock
//         ],
//     });
//     const announceRes = await suiClient.signAndExecuteTransaction({
//         signer: suiKeypair,
//         transaction: tx,
//         options: { showEffects: true, showObjectChanges: true },
//     });
//     console.log('partial_announce_order result:', announceRes);
//     const orderId = announceRes.objectChanges?.find(change => change.type === 'created')?.objectId;
//     // Return the orderId AND the merkleData object so you can generate proofs later
//     return { orderId, merkleData: generateMerkleData(partsCount, secretPreimageBase) }; // Re-generate to get access to getProofForIndex
// }
function partialAnnounceOrder(totalAmount, partsCount, merkleRoot) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, announceRes, orderId, evt;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    tx = new transactions_1.Transaction();
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::partial_announce_order"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.pure.u64(totalAmount),
                            tx.pure.u64(1000000000), // start_price
                            tx.pure.u64(900000000), // reserve_price
                            tx.pure.u64(60 * 1000), // duration_ms
                            tx.pure.u64(partsCount),
                            tx.pure.vector('u8', hexToU8Vector(merkleRoot)),
                            tx.object('0x6'), // clock
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairUser,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true, showEvents: true },
                        })];
                case 1:
                    announceRes = _d.sent();
                    console.log('partial_announce_order result:', announceRes);
                    orderId = (_b = (_a = announceRes.objectChanges) === null || _a === void 0 ? void 0 : _a.find(function (change) { return change.type === 'created'; })) === null || _b === void 0 ? void 0 : _b.objectId;
                    evt = (_c = announceRes.events) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.type.endsWith('PartialOrderAnnouncedEvent'); });
                    return [2 /*return*/, { orderId: orderId }];
            }
        });
    });
}
function fillOrderPartial(orderId, fillAmount, targetSecretIndex, targetSecretHash) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, tgHash, fillRes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tx = new transactions_1.Transaction();
                    tgHash = hexToU8Vector(targetSecretHash);
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::fill_order_partial"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(orderId),
                            tx.pure.u64(fillAmount),
                            tx.pure.u64(1000000000), // bid_price - Set to start_price or higher
                            tx.pure.vector('u8', tgHash),
                            tx.pure.u64(targetSecretIndex),
                            tx.object('0x6'), // clock
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    fillRes = _a.sent();
                    console.log('fill_order_partial result:', fillRes);
                    return [2 /*return*/, fillRes];
            }
        });
    });
}
// --- CREATE HTLC SRC PARTIAL ---
function createHTLCSrcPartial(orderId, secretPreimage, resolverAddress, hashLockIndex) {
    return __awaiter(this, void 0, void 0, function () {
        var secretHash, tx, htlcCoin, res;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    secretHash = hexToU8Vector((0, ethers_1.keccak256)((0, ethers_1.toUtf8Bytes)(secretPreimage)));
                    tx = new transactions_1.Transaction();
                    htlcCoin = tx.splitCoins(tx.gas, [
                        tx.pure.u64(25000000)
                    ])[0];
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::create_htlc_escrow_src_partial"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(orderId),
                            tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }),
                            tx.pure.vector('u8', secretHash),
                            tx.pure.u64(FINALITY_LOCK_DURATION_MS),
                            tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
                            tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
                            tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
                            tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
                            tx.pure.address(resolverAddress),
                            tx.pure.u64(hashLockIndex),
                            tx.object('0x6'), // clock
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairUser,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _c.sent();
                    console.log("createHTLCSrcPartial result:", res);
                    return [2 /*return*/, (_b = (_a = res.objectChanges) === null || _a === void 0 ? void 0 : _a.find(function (change) { return change.type === 'created'; })) === null || _b === void 0 ? void 0 : _b.objectId];
            }
        });
    });
}
// --- CREATE HTLC DST PARTIAL ---
function createHTLCDstPartial(secretPreimage, makerAddress, resolverAddress, originalPartialOrderId, hashLockIndex) {
    return __awaiter(this, void 0, void 0, function () {
        var secretHash, tx, _a, htlcCoin, safetyDepositCoin, res;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    secretHash = hexToU8Vector((0, ethers_1.keccak256)((0, ethers_1.toUtf8Bytes)(secretPreimage)));
                    tx = new transactions_1.Transaction();
                    _a = tx.splitCoins(tx.gas, [
                        tx.pure.u64(25000000),
                        tx.pure.u64(5000000),
                    ]), htlcCoin = _a[0], safetyDepositCoin = _a[1];
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::create_htlc_escrow_dst_partial"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.makeMoveVec({ elements: [tx.object(htlcCoin)] }),
                            tx.object(safetyDepositCoin),
                            tx.pure.vector('u8', secretHash),
                            tx.pure.u64(FINALITY_LOCK_DURATION_MS),
                            tx.pure.u64(RESOLVER_EXCLUSIVE_UNLOCK_DURATION_MS),
                            tx.pure.u64(RESOLVER_CANCELLATION_DURATION_MS),
                            tx.pure.u64(MAKER_CANCELLATION_DURATION_MS),
                            tx.pure.u64(PUBLIC_CANCELLATION_INCENTIVE_DURATION_MS),
                            tx.pure.address(makerAddress),
                            tx.pure.address(resolverAddress),
                            tx.object(originalPartialOrderId),
                            tx.pure.u64(hashLockIndex),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypairResolver,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _d.sent();
                    console.log('create_htlc_escrow_dst_partial result:', res);
                    return [2 /*return*/, (_c = (_b = res.objectChanges) === null || _b === void 0 ? void 0 : _b.find(function (change) { return change.type === 'created'; })) === null || _c === void 0 ? void 0 : _c.objectId];
            }
        });
    });
}
// --- TEST FUNCTIONS ---
// async function testStandardHTLCFlow() {
//     console.log("\n--- Testing Standard HTLC Flow ---");
//     const secret = 'standard_secret_123';
//     const orderId = await announceStandardOrder(secret);
//     if (orderId) {
//         await fillStandardOrder(orderId);
//         console.log("Standard Order filled successfully.");
//         const htlcSrcId = await createHTLCSrc(secret, orderId, suiAddress);
//         console.log("Standard HTLC created on source chain:", htlcSrcId);
//         if (htlcSrcId) {
//             await addSafetyDeposit(htlcSrcId, suiKeypair);
//             console.log("Safety deposit added successfully.");
//             console.log("Waiting for finality lock to expire for claim (Standard Flow)...");
//             await new Promise(r => setTimeout(r, FINALITY_LOCK_DURATION_MS + 1000));
//             await claimHTLC(htlcSrcId, secret);
//             console.log("Standard HTLC claimed successfully.");
//         }
//     } else {
//         console.error("Standard Order ID not found.");
//     }
// }
// async function testPartialHTLCFlow() {
//     console.log("\n--- Testing Partial HTLC Flow ---");
//     const secretPreimageBase = 'partial_order_master_secret';
//     const partsCount = 4; // N=4 means 5 secrets (0-4)
//     const totalOrderAmount = 100_000_000;
//     // 1. Announce Partial Order and get the merkleData object back
//     // const { orderId: partialOrderId, merkleData } = await partialAnnounceOrder(totalOrderAmount, partsCount, secretPreimageBase);
//   const { orderId: partialOrderId, merkleData } = await partialAnnounceOrder(totalOrderAmount, partsCount, secretPreimageBase);
//     if (partialOrderId) {
//         console.log("Partial Order Announced ID:", partialOrderId);
//         // --- First Partial Fill (e.g., for secret at index 0) ---
//         const fillAmount1 = totalOrderAmount / partsCount;
//         const targetIndex1 = 0; // First secret
//         console.log("🧪 Debugging Merkle Proof for index", targetIndex1);
//         console.log("Merkle Root:", Buffer.from(merkleData.merkleRoot).toString('hex'));
//         console.log("Leaf Hash for index 0:", Buffer.from(merkleData.getLeafHashForIndex(targetIndex1)).toString('hex'));
//         console.log("Proof for index 0:", merkleData.getProofForIndex(targetIndex1).map(p => Buffer.from(p).toString('hex')));
//         const fillRes1 = await fillOrderPartial(partialOrderId, fillAmount1, merkleData, targetIndex1);
//         console.log("First partial fill result:", fillRes1);
//         const htlcSrcPartialId1 = await createHTLCSrcPartial(
//             partialOrderId,
//             merkleData.secretPreimages[targetIndex1], // Pass the specific secret preimage for this index
//             suiAddress,
//             targetIndex1
//         );
//         console.log("Partial HTLC SRC created (part 1):", htlcSrcPartialId1);
//         if (htlcSrcPartialId1) {
//             await addSafetyDeposit(htlcSrcPartialId1, suiKeypair);
//             console.log("Safety deposit added for partial HTLC (part 1).");
//             console.log("Waiting for finality lock to expire for partial claim (part 1)...");
//             await new Promise(r => setTimeout(r, FINALITY_LOCK_DURATION_MS + 1000));
//             await claimHTLC(htlcSrcPartialId1, merkleData.secretPreimages[targetIndex1]);
//             console.log("Partial HTLC claimed successfully (part 1).");
//         }
//         // --- Simulate another partial fill (e.g., for secret at index 1) ---
//         console.log("\n--- Simulating another partial fill for cancellation test ---");
//         const fillAmount2 = totalOrderAmount / partsCount;
//         const targetIndex2 = 1; // Use the next secret index (assuming it's valid for your mock logic)
//         const fillRes2 = await fillOrderPartial(partialOrderId, fillAmount2, merkleData, targetIndex2);
//         console.log("Second partial fill result:", fillRes2);
//         const htlcDstPartialId1 = await createHTLCDstPartial(
//             merkleData.secretPreimages[targetIndex2], // Specific secret preimage
//             suiAddress, // Maker
//             suiAddress, // Resolver
//             partialOrderId,
//             targetIndex2
//         );
//         console.log("Partial HTLC DST created (part 2):", htlcDstPartialId1);
//         if (htlcDstPartialId1) {
//             console.log("Waiting for maker cancellation window for recovery (Partial Flow)...");
//             await new Promise(r => setTimeout(r, MAKER_CANCELLATION_DURATION_MS + 2000));
//             await recoverHTLC(htlcDstPartialId1);
//             console.log("Partial HTLC DST recovered successfully (part 2).");
//         }
//     } else {
//         console.error("Partial Order ID not found.");
//     }
// }
// // --- Main execution ---
// async function main() {
//     await testStandardHTLCFlow().catch(err => console.error("Error in Standard HTLC Flow:", err));
//     await testPartialHTLCFlow().catch(err => console.error("Error in Partial HTLC Flow:", err));
// }
// main().catch(console.error);
