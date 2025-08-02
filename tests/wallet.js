"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.Wallet = void 0;
var ethers_1 = require("ethers");
var IERC20_json_1 = require("../dist/contracts/IERC20.sol/IERC20.json");
var coder = ethers_1.AbiCoder.defaultAbiCoder();
var Wallet = /** @class */ (function () {
    function Wallet(privateKeyOrSigner, provider) {
        this.provider = provider;
        this.signer =
            typeof privateKeyOrSigner === 'string'
                ? new ethers_1.Wallet(privateKeyOrSigner, this.provider)
                : privateKeyOrSigner;
    }
    Wallet.fromAddress = function (address, provider) {
        return __awaiter(this, void 0, void 0, function () {
            var signer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, provider.send('anvil_impersonateAccount', [address.toString()])];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, provider.getSigner(address.toString())];
                    case 2:
                        signer = _a.sent();
                        return [2 /*return*/, new Wallet(signer, provider)];
                }
            });
        });
    };
    Wallet.prototype.tokenBalance = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var tokenContract, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        tokenContract = new ethers_1.Contract(token.toString(), IERC20_json_1.abi, this.provider);
                        _b = (_a = tokenContract).balanceOf;
                        return [4 /*yield*/, this.getAddress()];
                    case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                }
            });
        });
    };
    Wallet.prototype.topUpFromDonor = function (token, donor, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var donorWallet, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, Wallet.fromAddress(donor, this.provider)];
                    case 1:
                        donorWallet = _d.sent();
                        _b = (_a = donorWallet).transferToken;
                        _c = [token];
                        return [4 /*yield*/, this.getAddress()];
                    case 2: return [4 /*yield*/, _b.apply(_a, _c.concat([_d.sent(), amount]))];
                    case 3:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Wallet.prototype.getAddress = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.signer.getAddress()];
            });
        });
    };
    Wallet.prototype.unlimitedApprove = function (tokenAddress, spender) {
        return __awaiter(this, void 0, void 0, function () {
            var currentApprove;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAllowance(tokenAddress, spender)
                        // for usdt like tokens
                    ];
                    case 1:
                        currentApprove = _a.sent();
                        if (!(currentApprove !== 0n)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.approveToken(tokenAddress, spender, 0n)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [4 /*yield*/, this.approveToken(tokenAddress, spender, (1n << 256n) - 1n)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Wallet.prototype.getAllowance = function (token, spender) {
        return __awaiter(this, void 0, void 0, function () {
            var contract, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        contract = new ethers_1.Contract(token.toString(), IERC20_json_1.abi, this.provider);
                        _b = (_a = contract).allowance;
                        return [4 /*yield*/, this.getAddress()];
                    case 1: return [2 /*return*/, _b.apply(_a, [_c.sent(), spender.toString()])];
                }
            });
        });
    };
    Wallet.prototype.transfer = function (dest, amount) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.signer.sendTransaction({
                            to: dest,
                            value: amount
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Wallet.prototype.transferToken = function (token, dest, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var tx;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.signer.sendTransaction({
                            to: token.toString(),
                            data: '0xa9059cbb' + coder.encode(['address', 'uint256'], [dest.toString(), amount]).slice(2)
                        })];
                    case 1:
                        tx = _a.sent();
                        return [4 /*yield*/, tx.wait()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Wallet.prototype.approveToken = function (token, spender, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var tx;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.signer.sendTransaction({
                            to: token.toString(),
                            data: '0x095ea7b3' + coder.encode(['address', 'uint256'], [spender.toString(), amount]).slice(2)
                        })];
                    case 1:
                        tx = _a.sent();
                        return [4 /*yield*/, tx.wait()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Wallet.prototype.signOrder = function (srcChainId, order) {
        return __awaiter(this, void 0, void 0, function () {
            var typedData;
            return __generator(this, function (_a) {
                typedData = order.getTypedData(srcChainId);
                return [2 /*return*/, this.signer.signTypedData(typedData.domain, { Order: typedData.types[typedData.primaryType] }, typedData.message)];
            });
        });
    };
    Wallet.prototype.send = function (param) {
        return __awaiter(this, void 0, void 0, function () {
            var res, receipt, _a, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.signer.sendTransaction(__assign(__assign({}, param), { gasLimit: 10000000, from: this.getAddress() }))];
                    case 1:
                        res = _d.sent();
                        return [4 /*yield*/, res.wait(1)];
                    case 2:
                        receipt = _d.sent();
                        if (!(receipt && receipt.status)) return [3 /*break*/, 4];
                        _c = {
                            txHash: receipt.hash
                        };
                        _a = BigInt;
                        return [4 /*yield*/, res.getBlock()];
                    case 3: return [2 /*return*/, (_c.blockTimestamp = _a.apply(void 0, [(_d.sent()).timestamp]),
                            _c.blockHash = res.blockHash,
                            _c)];
                    case 4:
                        _b = Error.bind;
                        return [4 /*yield*/, (receipt === null || receipt === void 0 ? void 0 : receipt.getResult())];
                    case 5: throw new (_b.apply(Error, [void 0, (_d.sent()) || 'unknown error']))();
                }
            });
        });
    };
    return Wallet;
}());
exports.Wallet = Wallet;
