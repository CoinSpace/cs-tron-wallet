import API from './API.js';
import { HDKey } from '@scure/bip32';
import { hex } from '@scure/base';
import { randomBytes } from '@noble/hashes/utils';
import {
  Address,
  TransactionCapsule,
  decodeTRC20data,
  getPublicKeyFromPrivateKey,
} from 'tronlib';
import {
  Amount,
  CsWallet,
  Transaction,
  errors,
} from '@coinspace/cs-common';

const TESTNET_EXPLORER = 'https://nile.tronscan.org';
const MAINNET_EXPLORER = 'https://tronscan.org';

class TronTransaction extends Transaction {
  get url() {
    if (this.development) {
      return `${TESTNET_EXPLORER}/#/transaction/${this.id}`;
    }
    return `${MAINNET_EXPLORER}/#/transaction/${this.id}`;
  }
}

export default class TronWallet extends CsWallet {
  #api;
  #publicKey;
  #address;
  #addressString;
  #coinBalance = 0n;
  #tokenBalance = 0n;
  #dustThreshold = 1n;
  #minConfirmations = 21;
  #transactions = new Map();

  // memorized functions
  #getMinerFee;
  #getChainParameters;

  get defaultSettings() {
    return {
      // https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
      // https://github.com/satoshilabs/slips/blob/master/slip-0044.md
      bip44: "m/44'/195'/0'",
    };
  }

  get isSettingsSupported() {
    if (this.crypto.type === 'coin') {
      return true;
    }
    // token
    return false;
  }

  get address() {
    return this.#addressString;
  }

  get balance() {
    if (this.crypto.type === 'coin') {
      return new Amount(this.#coinBalance, this.crypto.decimals);
    }
    if (this.crypto.type === 'token') {
      return new Amount(this.#tokenBalance, this.crypto.decimals);
    }
    throw new errors.InternalWalletError('Unsupported crypto type');
  }

  get tokenUrl() {
    if (this.crypto.type === 'token') {
      if (this.development) {
        return `${TESTNET_EXPLORER}/#/contract/${this.crypto.address}`;
      }
      return `${MAINNET_EXPLORER}/#/contract/${this.crypto.address}`;
    }
    return undefined;
  }

  get dummyExchangeDepositAddress() {
    return Address.fromPublicKey(randomBytes(65)).toBase58Check();
  }

  constructor(options = {}) {
    super(options);
    this.#api = new API(this);
    this.#getMinerFee = this.memoize(this._getMinerFee);
    this.#getChainParameters = this.memoize(this._getChainParameters);
  }

  #keypairFromSeed(seed) {
    const hdkey = HDKey
      .fromMasterSeed(seed)
      .derive(this.settings.bip44);
    return hdkey;
  }

  async create(seed) {
    this.state = CsWallet.STATE_INITIALIZING;
    this.typeSeed(seed);
    const hdkey = this.#keypairFromSeed(seed);
    //Tron uses uncompressed public key O_o
    //this.#publicKey = hdkey.publicKey;
    this.#publicKey = getPublicKeyFromPrivateKey(hdkey.privateKey);
    this.#init();
    this.state = CsWallet.STATE_INITIALIZED;
  }

  async open(publicKey) {
    this.typePublicKey(publicKey);
    this.state = CsWallet.STATE_INITIALIZING;
    if (publicKey.settings.bip44 === this.settings.bip44) {
      this.#publicKey = hex.decode(publicKey.data);
      this.#init();
      this.state = CsWallet.STATE_INITIALIZED;
    } else {
      this.state = CsWallet.STATE_NEED_INITIALIZATION;
    }
  }

  #init() {
    this.#address = Address.fromPublicKey(this.#publicKey);
    this.#addressString = this.#address.toBase58Check();
    if (this.crypto.type === 'coin') {
      this.#coinBalance = BigInt(this.storage.get('balance') || 0);
    }
    if (this.crypto.type === 'token') {
      this.#tokenBalance = BigInt(this.storage.get('balance') || 0);
    }
  }

  async load() {
    this.state = CsWallet.STATE_LOADING;
    try {
      if (this.crypto.type === 'coin') {
        this.#coinBalance = await this.#getCoinBalance();
        this.storage.set('balance', this.#coinBalance.toString());
      }
      if (this.crypto.type === 'token') {
        this.#tokenBalance = await this.#getTokenBalance();
        this.#coinBalance = await this.#getCoinBalance();
        this.storage.set('balance', this.#tokenBalance.toString());
      }
      await this.storage.save();
      this.state = CsWallet.STATE_LOADED;
    } catch (err) {
      this.state = CsWallet.STATE_ERROR;
      throw err;
    }
  }

  async cleanup() {
    await super.cleanup();
    this.memoizeClear(this.#getMinerFee);
    this.memoizeClear(this.#getChainParameters);
  }

  getPublicKey() {
    return {
      settings: this.settings,
      data: hex.encode(this.#publicKey),
    };
  }

  getPrivateKey(seed) {
    this.typeSeed(seed);
    const hdkey = this.#keypairFromSeed(seed);
    return [{
      address: this.#addressString,
      privatekey: hex.encode(hdkey.privateKey),
    }];
  }

  async #getCoinBalance() {
    const balance = await this.#api.coinBalance(this.#addressString);
    return BigInt(balance || 0);
  }

  async #getTokenBalance() {
    const balance = await this.#api.tokenBalance(this.#addressString, this.crypto.address);
    return BigInt(balance || 0);
  }

  async #getLatestBlock() {
    return this.#api.latestBlock();
  }

  async _getChainParameters() {
    return this.#api.chainParameters();
  }

  async #getFeeLimit() {
    if (this.crypto.type === 'coin') {
      const chainParameters = await this.#getChainParameters();
      return BigInt(chainParameters.getCreateAccountFee + chainParameters.getCreateNewAccountFeeInSystemContract);
    }
    if (this.crypto.type === 'token') {
      // TODO estimate honestly
      return 10_000_000n;
    }
  }

  async _getMinerFee({ address, value }) {
    // https://github.com/tronprotocol/java-tron/issues/4737#issuecomment-1292888641
    // https://github.com/tronprotocol/java-tron/issues/5239#issuecomment-1563749462
    const chainParameters = await this.#getChainParameters();
    const SUN_PER_NET = BigInt(chainParameters.getTransactionFee);
    const SUN_PER_ENERGY = BigInt(chainParameters.getEnergyFee);
    const feeLimit = await this.#getFeeLimit();
    if (this.crypto.type === 'coin') {
      const destinationAccount = await this.#api.account(address.toBase58Check());
      if (!destinationAccount) {
        return feeLimit;
      }
      const resources = await this.#api.resources(this.#addressString);
      const net = resources.freeNetLimit - (resources.freeNetUsed || 0);
      const size = TransactionCapsule.estimateTransferSize(value, feeLimit);
      if (size <= net) {
        return 0n;
      } else {
        return BigInt(size) * SUN_PER_NET;
      }
    }
    if (this.crypto.type === 'token') {
      const energy = await this.#api.estimateEnergy(
        this.crypto.address,
        this.#addressString,
        address.toBase58Check(),
        value
      );
      const feeEnergy = BigInt(energy) * SUN_PER_ENERGY;
      const resources = await this.#api.resources(this.#addressString);
      const net = resources.freeNetLimit - (resources.freeNetUsed || 0);
      const size = TransactionCapsule.estimateTransferTokenSize(value, feeLimit);
      if (size <= net) {
        return feeEnergy;
      } else {
        return (BigInt(size) * SUN_PER_NET) + feeEnergy;
      }
    }
  }

  #parseAddress(address) {
    try {
      return Address.fromBase58Check(address);
    } catch (err) {
      throw new errors.InvalidAddressError(address, { cause: err });
    }
  }

  async validateAddress({ address }) {
    super.validateAddress({ address });
    const parsedAddress = this.#parseAddress(address);
    if (parsedAddress.equals(this.#address)) {
      throw new errors.DestinationEqualsSourceError();
    }
    return true;
  }

  async validateAmount({ address, amount }) {
    super.validateAmount({ address, amount });
    const destinationAddress = this.#parseAddress(address);
    const { value } = amount;
    if (value < this.#dustThreshold) {
      throw new errors.SmallAmountError(new Amount(this.#dustThreshold, this.crypto.decimals));
    }
    if (this.crypto.type === 'token') {
      const fee = await this.#getMinerFee({ address: destinationAddress, value });
      if (fee > this.#coinBalance) {
        throw new errors.InsufficientCoinForTokenTransactionError(new Amount(fee, this.platform.decimals));
      }
    }
    const maxAmount = await this.#estimateMaxAmount({ address: destinationAddress });
    if (value > maxAmount) {
      throw new errors.BigAmountError(new Amount(maxAmount, this.crypto.decimals));
    }
    return true;
  }

  async estimateTransactionFee({ address, amount }) {
    super.estimateTransactionFee({ address, amount });
    const destinationAddress = this.#parseAddress(address);
    const { value } = amount;
    const fee = await this.#getMinerFee({ address: destinationAddress, value });
    if (this.crypto.type === 'coin') {
      return new Amount(fee, this.crypto.decimals);
    }
    if (this.crypto.type === 'token') {
      return new Amount(fee, this.platform.decimals);
    }
  }

  async #estimateMaxAmount({ address }) {
    if (this.crypto.type === 'coin') {
      const minerFee = await this.#getMinerFee({
        address,
        value: this.#coinBalance,
      });
      if (this.#coinBalance < minerFee) {
        return 0n;
      }
      return this.#coinBalance - minerFee;
    }
    if (this.crypto.type === 'token') {
      return this.#tokenBalance;
    }
  }

  async estimateMaxAmount({ address }) {
    super.estimateMaxAmount({ address });
    const destinationAddress = this.#parseAddress(address);
    const maxAmount = await this.#estimateMaxAmount({ address: destinationAddress });
    return new Amount(maxAmount, this.crypto.decimals);
  }

  async createTransaction({ address, amount }, seed) {
    super.createTransaction({ address, amount }, seed);
    const destinationAddress = this.#parseAddress(address);
    const { value } = amount;
    const fee = await this.#getMinerFee({ address: destinationAddress, value });

    const transaction = this.crypto.type === 'coin'
      ? TransactionCapsule.createTransfer(
        this.#address,
        destinationAddress,
        value
      )
      : TransactionCapsule.createTransferToken(
        Address.fromBase58Check(this.crypto.address),
        this.#address,
        destinationAddress,
        value
      );
    const { blockID, blockNumber, blockTimestamp } = await this.#getLatestBlock();
    const feeLimit = await this.#getFeeLimit();
    transaction.addRefs(
      hex.decode(blockID),
      blockNumber,
      blockTimestamp,
      (feeLimit > fee) ? feeLimit : fee
    );
    transaction.sign(this.#keypairFromSeed(seed).privateKey);
    const res = await this.#api.submitTransaction(hex.encode(transaction.serialize()));
    if (res?.code === 'SUCCESS') {
      if (this.crypto.type === 'coin') {
        this.#coinBalance -= (value + fee);
        this.storage.set('balance', this.#coinBalance.toString());
      } else {
        this.#tokenBalance -= value;
        this.#coinBalance -= fee;
        this.storage.set('balance', this.#tokenBalance.toString());
      }
      await this.storage.save();
      return res.txid;
    }
    throw errors.NodeError(`NodeError ${res?.code}`);
  }

  async loadTransactions({ cursor } = {}) {
    if (!cursor) {
      this.#transactions.clear();
    }
    const res = this.crypto.type === 'coin'
      ? await this.#api.loadTransactions(this.#addressString, this.txPerPage, cursor)
      : await this.#api.loadTokenTransactions(this.#addressString, this.crypto.address, this.txPerPage, cursor);
    const transactions = this.#transformTxs(res.data);
    for (const transaction of transactions) {
      this.#transactions.set(transaction.id, transaction);
    }
    return {
      transactions,
      hasMore: res.data.length === this.txPerPage,
      cursor: res.meta?.fingerprint,
    };
  }

  async loadTransaction(id) {
    if (this.#transactions.has(id)) {
      return this.#transactions.get(id);
    }
  }

  #transformTxs(txs) {
    return txs.map((tx) => {
      return this.crypto.type === 'token' ? this.#transformTRC20Tx(tx) : this.#transformTx(tx);
    });
  }

  #transformTx(tx) {
    const hexAddress = Address.fromPublicKey(this.#publicKey).toHex();
    const contract = tx.raw_data.contract[0];
    const status = tx.ret[0].contractRet === 'SUCCESS'
      ? (tx.confirmations >= this.#minConfirmations ? Transaction.STATUS_SUCCESS : Transaction.STATUS_PENDING)
      : Transaction.STATUS_FAILED;
    if (contract.type === 'TransferContract') {
      const incoming = contract.parameter.value.to_address === hexAddress;
      return new TronTransaction({
        status,
        id: tx.txID,
        amount: new Amount(contract.parameter.value.amount, this.crypto.decimals),
        incoming,
        from: Address.fromHex(contract.parameter.value.owner_address).toBase58Check(),
        to: Address.fromHex(contract.parameter.value.to_address).toBase58Check(),
        fee: new Amount(tx.ret[0].fee, this.platform.decimals),
        timestamp: new Date(tx.block_timestamp),
        confirmations: tx.confirmations,
        minConfirmations: this.#minConfirmations,
        development: this.development,
      });
    } else if (contract.type === 'TriggerSmartContract') {
      const data = decodeTRC20data(hex.decode(contract.parameter.value.data));
      const incoming = data.addressTo.toBase58Check() === this.#addressString;
      return new TronTransaction({
        status,
        id: tx.txID,
        amount: new Amount(0, this.crypto.decimals),
        incoming,
        from: Address.fromHex(contract.parameter.value.owner_address).toBase58Check(),
        to: Address.fromHex(contract.parameter.value.contract_address).toBase58Check(),
        fee: new Amount(tx.ret[0].fee, this.platform.decimals),
        timestamp: new Date(tx.block_timestamp),
        confirmations: tx.confirmations,
        minConfirmations: this.#minConfirmations,
        development: this.development,
      });
    } else {
      // Unsupported transaction type
      let from = '';
      try {
        from = Address.fromHex(contract.parameter.value.owner_address).toBase58Check();
      // eslint-disable-next-line no-empty
      } catch (err) {}
      return new TronTransaction({
        status,
        id: tx.txID,
        amount: new Amount(0, this.crypto.decimals),
        incoming: true,
        from,
        to: '',
        fee: new Amount(tx.ret[0].fee, this.platform.decimals),
        timestamp: new Date(tx.block_timestamp),
        confirmations: tx.confirmations,
        minConfirmations: this.#minConfirmations,
        development: this.development,
      });
    }
  }

  #transformTRC20Tx(tx) {
    const incoming = tx.to === this.#addressString;
    return new TronTransaction({
      status: Transaction.STATUS_SUCCESS,
      id: tx.transaction_id,
      amount: new Amount(tx.value, this.crypto.decimals),
      incoming,
      from: tx.from,
      to: tx.to,
      fee: undefined,
      timestamp: new Date(tx.block_timestamp),
      confirmations: 0,
      minConfirmations: 0,
      development: this.development,
    });
  }
}
