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
var client_1 = require("@mysten/sui/client");
var ed25519_1 = require("@mysten/sui/keypairs/ed25519");
var transactions_1 = require("@mysten/sui/transactions");
var dotenv_1 = require("dotenv");
var ethers_1 = require("ethers");
(0, dotenv_1.config)();
var SUI_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;
var SUI_PACKAGE_ID = process.env.SUI_PACKAGE_ID;
var suiClient = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('testnet') });
var suiKeypair = ed25519_1.Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY, 'hex'));
var suiAddress = suiKeypair.getPublicKey().toSuiAddress();
// async function ensureTwoCoins(): Promise<{ depositCoin: string, gasCoin: string }> {
//   const resp = await suiClient.getCoins({ owner: suiAddress, coinType: '0x2::sui::SUI' });
//   const coins = resp.data.filter(c => BigInt(c.balance) >= 100_000_000n);
//   if (coins.length >= 2) {
//     // Already have two suitable coins
//     return { depositCoin: coins[0].coinObjectId, gasCoin: coins[1].coinObjectId };
//   } else if (coins.length === 1) {
//     // Only one large coin: split it into two
//     const coinToSplit = coins[0];
//     console.log(`Splitting coin ${coinToSplit.coinObjectId} into two coins of 0.1 SUI each...`);
//     const tx = new Transaction();
//     // tx.splitCoins({
//     //   coin: tx.object(coinToSplit.coinObjectId),
//     //   amounts: [100_000_000, 100_000_000], // 0.1 SUI each
//     // });
//     tx.splitCoins(tx.gas, [tx.pure.u64(50_000_000)])
//     tx.setGasBudget(1000000); // adjust gas budget if needed
//     const splitResult = await suiClient.signAndExecuteTransaction({
//       signer: suiKeypair,
//       transaction: tx,
//       options: { showEffects: true, showObjectChanges: true },
//     });
//     // Extract the newly created coins from objectChanges
//     const createdCoins = splitResult.objectChanges?.filter(
//       c => c.type === 'created' && c.objectType === '0x2::coin::Coin<0x2::sui::SUI>'
//     );
//     if (!createdCoins || createdCoins.length < 2) {
//       throw new Error('Failed to split coin into two parts');
//     }
//     console.log('Split coins created:', createdCoins.map(c => c.objectId));
//     return { depositCoin: createdCoins[0].objectId, gasCoin: createdCoins[1].objectId };
//   } else {
//     throw new Error('No coins with balance >= 0.1 SUI found');
//   }
// }
function createHTLC(secretPreimage, timelockMs) {
    return __awaiter(this, void 0, void 0, function () {
        var secretHash, tx, secretHashBytes, secretHashNumberArray, coins, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    secretHash = (0, ethers_1.keccak256)((0, ethers_1.toUtf8Bytes)(secretPreimage));
                    tx = new transactions_1.Transaction();
                    secretHashBytes = Buffer.from(secretHash.slice(2), 'hex');
                    secretHashNumberArray = Array.from(secretHashBytes);
                    coins = tx.splitCoins(tx.gas, [tx.pure.u64(50000000)])[0];
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::create_htlc_escrow"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.makeMoveVec({ elements: [tx.object(coins)] }),
                            tx.pure.vector('u8', secretHashNumberArray),
                            tx.pure.u64(timelockMs),
                            tx.pure.address(suiAddress),
                            tx.pure.address(suiAddress),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypair,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _a.sent();
                    console.log('create_htlc_escrow result:', res);
                    return [2 /*return*/, res];
            }
        });
    });
}
function claimHTLC(htlcId, secretPreimage) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, secretPreimageBytes, secretPreimageNumberArray, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('The HTLC ID is:', htlcId);
                    console.log('The secret preimage is:', secretPreimage);
                    tx = new transactions_1.Transaction();
                    secretPreimageBytes = (0, ethers_1.toUtf8Bytes)(secretPreimage);
                    secretPreimageNumberArray = Array.from(secretPreimageBytes);
                    tx.moveCall({
                        target: "".concat(SUI_PACKAGE_ID, "::htlc::claim_htlc_escrow"),
                        typeArguments: ['0x2::sui::SUI'],
                        arguments: [
                            tx.object(htlcId),
                            tx.pure.vector('u8', secretPreimageNumberArray),
                            tx.object('0x6'),
                        ],
                    });
                    return [4 /*yield*/, suiClient.signAndExecuteTransaction({
                            signer: suiKeypair,
                            transaction: tx,
                            options: { showEffects: true, showObjectChanges: true },
                        })];
                case 1:
                    res = _a.sent();
                    console.log('claim_htlc_escrow result:', res);
                    return [2 /*return*/, res];
            }
        });
    });
}
function recoverHTLC(htlcId) {
    return __awaiter(this, void 0, void 0, function () {
        var tx, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
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
                            signer: suiKeypair,
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
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var secret, duration, createR, htlcId;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    secret = 'my_super_secret';
                    duration = 5 * 60 * 1000;
                    return [4 /*yield*/, createHTLC(secret, duration)];
                case 1:
                    createR = _c.sent();
                    htlcId = (_b = (_a = createR.objectChanges) === null || _a === void 0 ? void 0 : _a.find(function (change) { return change.type === 'created'; })) === null || _b === void 0 ? void 0 : _b.objectId;
                    console.log("Created HTLC ID:", htlcId);
                    return [4 /*yield*/, claimHTLC(htlcId, secret)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, duration + 1000); })];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
