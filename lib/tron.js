/* eslint max-len: ["error", { "code": 120, "ignoreComments": true }] */
import { createHash } from 'crypto';
import Contract from '@tronscan/client/src/protocol/core/Contract_pb.js';
import Tron from '@tronscan/client/src/protocol/core/Tron_pb.js';
import { buildTransferContract } from '@tronscan/client/src/utils/transactionBuilder.js';
import {
  decode58Check,
  signTransaction,
  getPubKeyFromPriKey,
} from '@tronscan/client/src/utils/crypto.js';
import { encodeString } from '@tronscan/client/src/lib/code.js';
import { byteArray2hexStr } from '@tronscan/client/src/utils/bytes.js';
import { utils } from 'ethers';
import sha3 from 'js-sha3';
import { ADDRESS_PREFIX } from '@tronscan/client/src/utils/address.js';
import { encode58, decode58 } from '@tronscan/client/src/lib/base58.js';

const TRANSFER_PREFIX = 'a9059cbb';

function composeTRC20data(to, amount = 0) {
  //const functionSelector = 'transfer(address,uint256)';
  //const selectorByteArray = sha3.keccak256.array(Buffer.from(functionSelector)).slice(0, 4);
  //const selectorHexStr = byteArray2hexStr(selectorByteArray)
  const types = ['address', 'uint256'];
  const toAddress = byteArray2hexStr(decode58Check(to)).replace(/^(41)/, '0x');
  const values = [toAddress, amount];

  const abiCoder = new utils.AbiCoder();
  const parameters = abiCoder.encode(types, values).replace(/^(0x)/, '');

  return TRANSFER_PREFIX + parameters;
}

export function decomposeTRC20data(data) {
  const types = ['address', 'uint256'];
  const abiCoder = new utils.AbiCoder();
  const decoded = abiCoder.decode(types, Buffer.from(data.replace(TRANSFER_PREFIX, ''), 'hex'));
  return {
    to: Address.fromHex(decoded[0].replace(/^(0x)/, ADDRESS_PREFIX)).toBase58Check(),
    amount: decoded[1].toString(),
  };
}

/**
 * https://github.com/tronscan/tronscan-node-client/blob/9a699ad3cef2bb5d6034196bbff0c383dc64fd3b/src/utils/transactionBuilder.js#L79-L105
 * https://github.com/tronscan/tronscan-node-client/blob/9a699ad3cef2bb5d6034196bbff0c383dc64fd3b/src/utils/transactionBuilder.js#L384-L403
 */
export function buildTransferTransaction(token, from, to, amount, value = {}) {
  if (token === '_') {
    const transferContract = new Contract.TransferContract();
    transferContract.setToAddress(Uint8Array.from(decode58Check(to)));
    transferContract.setOwnerAddress(Uint8Array.from(decode58Check(from)));
    transferContract.setAmount(amount);

    return buildTransferContract(
      transferContract,
      Tron.Transaction.Contract.ContractType.TRANSFERCONTRACT,
      'TransferContract');
  } else if (token.startsWith('T')) {
    const transferContract = new Contract.TriggerSmartContract();
    // owner_address
    transferContract.setOwnerAddress(Uint8Array.from(decode58Check(from)));
    // contract_address
    transferContract.setContractAddress(Uint8Array.from(decode58Check(token)));
    transferContract.setData(Buffer.from(composeTRC20data(to, amount), 'hex'));
    if (value.token_id) {
      transferContract.setTokenId(value.token_id);
    }
    if (value.call_token_value) {
      transferContract.setCallTokenValue(value.call_token_value);
    }
    if (value.call_value) {
      transferContract.setCallValue(value.call_value);
    }
    return buildTransferContract(
      transferContract,
      Tron.Transaction.Contract.ContractType.TRIGGERSMARTCONTRACT,
      'TriggerSmartContract');
  } else {
    const transferContract = new Contract.TransferAssetContract();
    transferContract.setToAddress(Uint8Array.from(decode58Check(to)));
    transferContract.setOwnerAddress(Uint8Array.from(decode58Check(from)));
    transferContract.setAmount(amount);
    transferContract.setAssetName(encodeString(token));

    return buildTransferContract(
      transferContract,
      Tron.Transaction.Contract.ContractType.TRANSFERASSETCONTRACT,
      'TransferAssetContract');
  }
}

/**
 * https://github.com/tronscan/tronscan-node-client/blob/9a699ad3cef2bb5d6034196bbff0c383dc64fd3b/src/client/http.js#L69-L89
 */

export function addRef(transaction, latestBlock, isTRC20 = false) {
  const number = Buffer.from(latestBlock.number.toString(16).padStart(8 * 2, '0'), 'hex');
  const hash = Buffer.from(latestBlock.hash, 'hex');
  const rawData = transaction.getRawData();
  rawData.setRefBlockHash(hash.subarray(8, 16));
  rawData.setRefBlockBytes(number.subarray(6, 8));
  if (isTRC20) {
    // TODO I don't know why we need it
    rawData.setFeeLimit(10000000);
    rawData.setTimestamp(latestBlock.timestamp);
  }
  rawData.setExpiration(latestBlock.timestamp + (60 * 5 * 1000));
  transaction.setRawData(rawData);
  return transaction;
}

export function sign(privateKey, transaction) {
  return signTransaction(privateKey, transaction);
}

export function pubKeyFromPriKey(privateKey) {
  return Buffer.from(getPubKeyFromPriKey(privateKey));
}

export class Address {
  #bytes;

  constructor(bytes) {
    if (bytes.length !== 21) {
      throw new Error('Invalid bytes');
    }
    if (bytes[0] !== 65) {
      throw new Error('Invalid prefix');
    }
    this.#bytes = bytes;
  }

  toHex() {
    return this.#bytes.toString('hex');
  }

  toBase58Check() {
    const hash = createHash('sha256').update(this.#bytes).digest();
    const check = createHash('sha256').update(hash).digest().slice(0, 4);
    return encode58(Buffer.concat([this.#bytes, check]));
  }

  static fromPublicKey(publicKey) {
    if (publicKey.length !== 65) {
      throw new TypeError('Invalid public key');
    }
    const hash = sha3.keccak256(publicKey.subarray(1));
    return new Address(Buffer.from(ADDRESS_PREFIX + hash.substring(24), 'hex'));
  }

  static fromBase58Check(address) {
    const decoded = Buffer.from(decode58(address));
    if (decoded.length < 4) {
      throw new TypeError('Invalid address');
    }
    const hash = createHash('sha256').update(decoded.subarray(0, -4)).digest();
    const check = createHash('sha256').update(hash).digest().slice(0, 4);
    if (!check.equals(decoded.subarray(-4))) {
      throw new TypeError('Invalid checksum');
    }
    return new Address(decoded.subarray(0, -4));
  }

  static fromHex(hex) {
    return new Address(Buffer.from(hex, 'hex'));
  }

  static isValid(address) {
    try {
      Address.fromBase58Check(address);
      return true;
    } catch {
      return false;
    }
  }
}
