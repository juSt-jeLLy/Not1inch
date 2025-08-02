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
exports.EscrowFactory = void 0;
var ethers_1 = require("ethers");
var EscrowFactory_json_1 = require("../dist/contracts/EscrowFactory.sol/EscrowFactory.json");
var cross_chain_sdk_1 = require("@1inch/cross-chain-sdk");
var EscrowFactory = /** @class */ (function () {
    function EscrowFactory(provider, address) {
        this.provider = provider;
        this.address = address;
        this.iface = new ethers_1.Interface(EscrowFactory_json_1.abi);
    }
    EscrowFactory.prototype.getSourceImpl = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.provider.call({
                            to: this.address,
                            data: (0, ethers_1.id)('ESCROW_SRC_IMPLEMENTATION()').slice(0, 10)
                        })];
                    case 1:
                        result = _a.sent();
                        if (!result || result === '0x') {
                            throw new Error('ESCROW_SRC_IMPLEMENTATION() call returned empty value ("0x"). Is the contract deployed and initialized?');
                        }
                        return [2 /*return*/, cross_chain_sdk_1.Address.fromBigInt(BigInt(result))];
                }
            });
        });
    };
    EscrowFactory.prototype.getDestinationImpl = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.provider.call({
                            to: this.address,
                            data: (0, ethers_1.id)('ESCROW_DST_IMPLEMENTATION()').slice(0, 10)
                        })];
                    case 1:
                        result = _a.sent();
                        if (!result || result === '0x') {
                            throw new Error('ESCROW_DST_IMPLEMENTATION() call returned empty value ("0x"). Is the contract deployed and initialized?');
                        }
                        return [2 /*return*/, cross_chain_sdk_1.Address.fromBigInt(BigInt(result))];
                }
            });
        });
    };
    EscrowFactory.prototype.getSrcDeployEvent = function (blockHash) {
        return __awaiter(this, void 0, void 0, function () {
            var event, logs, data, immutables, complement;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        event = this.iface.getEvent('SrcEscrowCreated');
                        return [4 /*yield*/, this.provider.getLogs({
                                blockHash: blockHash,
                                address: this.address,
                                topics: [event.topicHash]
                            })];
                    case 1:
                        logs = _a.sent();
                        data = logs.map(function (l) { return _this.iface.decodeEventLog(event, l.data); })[0];
                        immutables = data.at(0);
                        complement = data.at(1);
                        return [2 /*return*/, [
                                cross_chain_sdk_1.Immutables.new({
                                    orderHash: immutables[0],
                                    hashLock: cross_chain_sdk_1.HashLock.fromString(immutables[1]),
                                    maker: cross_chain_sdk_1.Address.fromBigInt(immutables[2]),
                                    taker: cross_chain_sdk_1.Address.fromBigInt(immutables[3]),
                                    token: cross_chain_sdk_1.Address.fromBigInt(immutables[4]),
                                    amount: immutables[5],
                                    safetyDeposit: immutables[6],
                                    timeLocks: cross_chain_sdk_1.TimeLocks.fromBigInt(immutables[7])
                                }),
                                cross_chain_sdk_1.DstImmutablesComplement.new({
                                    maker: cross_chain_sdk_1.Address.fromBigInt(complement[0]),
                                    amount: complement[1],
                                    token: cross_chain_sdk_1.Address.fromBigInt(complement[2]),
                                    safetyDeposit: complement[3]
                                })
                            ]];
                }
            });
        });
    };
    return EscrowFactory;
}());
exports.EscrowFactory = EscrowFactory;
