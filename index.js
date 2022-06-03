import HDKey from 'hdkey';
import BigNumber from 'bignumber.js';
import {
  buildTransferTransaction,
  addRef,
  sign,
  pubKeyFromPriKey,
  decomposeTRC20data,
  Address,
} from './lib/tron.js';

// https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const BIP44_PATH = "m/44'/195'/0'/0/0";

export default class TronWallet {
  #crypto;
  #platformCrypto;
  #cache;
  #balance;
  #request;
  #apiNode;
  //#apiWeb;

  #privateKey;
  #publicKey;

  #txsPerPage = 5;
  #txsCursor = undefined;
  #hasMoreTxs = true;
  #feeRates = [{
    name: 'default',
    default: true,
  }];
  #useTestNetwork;

  // TODO calculate honestly O_o
  #minerFee = new BigNumber(1100000);

  get isLocked() {
    return !this.#privateKey;
  }

  get addressTypes() {
    return ['base'];
  }

  get feeRates() {
    return this.#feeRates.map((item) => {
      return {
        name: item.name,
        default: item.default === true,
      };
    });
  }

  get balance() {
    return this.#balance.toString(10);
  }

  get crypto() {
    return this.#crypto;
  }

  get platformCrypto() {
    return this.#platformCrypto;
  }

  constructor(options = {}) {
    if (!options.crypto) {
      throw new TypeError('crypto should be passed');
    }
    this.#crypto = options.crypto;

    if (!options.platformCrypto) {
      throw new TypeError('platformCrypto should be passed');
    }
    this.#platformCrypto = options.platformCrypto;

    if (!options.cache) {
      throw new TypeError('cache should be passed');
    }
    this.#cache = options.cache;

    if (!options.request) {
      throw new TypeError('request should be passed');
    }
    this.#request = options.request;

    if (!options.apiNode) {
      throw new TypeError('apiNode should be passed');
    }
    this.#apiNode = options.apiNode;

    /*
    if (!options.apiWeb) {
      throw new TypeError('apiWeb should be passed');
    }
    this.#apiWeb = options.apiWeb;
    */

    if (options.seed) {
      const hdkey = HDKey
        .fromMasterSeed(Buffer.from(options.seed, 'hex'))
        .derive(BIP44_PATH);
      this.#privateKey = hdkey.privateKey;
      //Tron uses uncompressed public key O_o
      //this.#publicKey = hdkey.publicKey;
      this.#publicKey = pubKeyFromPriKey(this.#privateKey);
    } else if (options.publicKey) {
      this.#publicKey = Buffer.from(JSON.parse(options.publicKey), 'hex');
    } else {
      throw new Error('seed or publicKey should be passed');
    }

    this.#balance = new BigNumber(this.#cache.get('balance') || 0);
    this.#useTestNetwork = !!options.useTestNetwork;
  }

  lock() {
    if (this.#privateKey) {
      this.#privateKey.fill(0);
    }
    this.#privateKey = null;
  }

  unlock(seed) {
    this.#privateKey = HDKey
      .fromMasterSeed(Buffer.from(seed, 'hex'))
      .derive(BIP44_PATH)
      .privateKey;
  }

  publicKey() {
    return JSON.stringify(this.#publicKey.toString('hex'));
  }

  #getAddress() {
    return Address.fromPublicKey(this.#publicKey).toBase58Check();
  }

  getNextAddress() {
    return this.#getAddress();
  }

  async load() {
    this.#balance = await this.#calculateBalance();
    this.#cache.set('balance', this.#balance);
    this.#txsCursor = undefined;
    this.#hasMoreTxs = true;
    this.#calculateMaxAmounts();
  }

  /*
  #requestWeb(config) {
    return this.#request({
      ...config,
      method: 'get',
      seed: 'public',
      baseURL: this.#apiWeb,
    });
  }
  */

  #requestNode(config) {
    return this.#request({
      ...config,
      seed: 'public',
      baseURL: this.#apiNode,
      disableDefaultCatch: true,
    }).catch((err) => {
      console.error(err);
      throw new Error('cs-node-error');
    });
  }

  async #getLatestBlock() {
    const latestBlock = await this.#requestNode({
      url: 'api/v1/latestblock',
    });
    return {
      hash: latestBlock.blockID,
      number: latestBlock.number,
      timestamp: latestBlock.timestamp,
    };
  }

  async #calculateBalance() {
    const account = await this.#requestNode({
      url: `api/v1/account/${this.#getAddress()}/balance`,
      method: 'get',
    });
    if (this.#crypto.type === 'token') {
      const trc20 = account.trc20 ? account.trc20.reduce((accum, item) => {
        return {
          ...accum,
          ...item,
        };
      }, {}) : {};
      return new BigNumber(trc20[this.#crypto.address] || 0);
    }
    return new BigNumber(account.balance || 0);
  }

  #calculateMaxAmount(feeRate) {
    if (feeRate.name !== 'default') {
      throw new Error('Unsupported fee rate');
    }

    if (this.#crypto.type === 'token') {
      return this.#balance;
    }

    if (this.#balance.isLessThanOrEqualTo(this.#minerFee)) {
      return new BigNumber(0);
    }
    const maxAmount = this.#balance.minus(this.#minerFee);
    if (maxAmount.isLessThan(0)) {
      return new BigNumber(0);
    }
    return maxAmount;
  }

  #calculateMaxAmounts() {
    for (const feeRate of this.#feeRates) {
      feeRate.maxAmount = this.#calculateMaxAmount(feeRate);
    }
  }

  estimateFees(/*value = 0*/) {
    return this.#feeRates.map((feeRate) => {
      return {
        name: feeRate.name,
        default: feeRate.default === true,
        estimate: this.#minerFee.toString(10),
        maxAmount: feeRate.maxAmount.toString(10),
      };
    });
  }

  async loadTxs() {
    if (!this.#hasMoreTxs) {
      return [];
    }
    const url = this.#crypto.type === 'token'
      ? `api/v1/account/${this.#getAddress()}/trc20/${this.#crypto.address}/transactions`
      : `api/v1/account/${this.#getAddress()}/transactions`;
    const res = await this.#requestNode({
      url,
      method: 'get',
      params: {
        limit: this.#txsPerPage,
        fingerprint: this.#txsCursor,
      },
    });
    this.#hasMoreTxs = res.data.length === this.#txsPerPage;
    if (res.data.length) {
      this.#txsCursor = res.meta.fingerprint;
    }
    return {
      txs: this.#transformTxs(res.data),
      hasMoreTxs: this.#hasMoreTxs,
    };
  }

  #transformTxs(txs) {
    return txs.map((tx) => {
      return this.#crypto.type === 'token' ? this.#transformTRC20Tx(tx) : this.#transformTx(tx);
    });
  }

  #transformTx(tx) {
    const hexAddress = Address.fromPublicKey(this.#publicKey).toHex();
    const contract = tx.raw_data.contract[0];
    if (contract.type === 'TransferContract') {
      const isIncoming = contract.parameter.value.to_address === hexAddress;
      return {
        status: tx.ret[0].contractRet === 'SUCCESS',
        id: tx.txID,
        from: Address.fromHex(contract.parameter.value.owner_address).toBase58Check(),
        to: Address.fromHex(contract.parameter.value.to_address).toBase58Check(),
        amount: isIncoming ? contract.parameter.value.amount : `-${contract.parameter.value.amount}`,
        timestamp: tx.block_timestamp,
        fee: tx.net_fee,
        isIncoming,
        // TODO confirmation
        confirmed: true,
      };
    } else if (contract.type === 'TriggerSmartContract') {
      const data = decomposeTRC20data(contract.parameter.value.data);
      const isIncoming = data.to === this.#getAddress();
      return {
        status: tx.ret[0].contractRet === 'SUCCESS',
        id: tx.txID,
        from: Address.fromHex(contract.parameter.value.owner_address).toBase58Check(),
        to: data.to,
        amount: 0,
        timestamp: tx.block_timestamp,
        fee: tx.net_fee,
        isIncoming,
        // TODO confirmation
        confirmed: true,
        //token: this.#crypto.address,
      };
    } else {
      // Unsupported transaction type
      let from = '';
      try {
        from = Address.fromHex(contract.parameter.value.owner_address).toBase58Check();
      // eslint-disable-next-line no-empty
      } catch (err) {}
      return {
        status: tx.ret[0].contractRet === 'SUCCESS',
        id: tx.txID,
        from,
        to: '',
        amount: 0,
        timestamp: tx.block_timestamp,
        fee: tx.net_fee,
        isIncoming: true,
        // TODO confirmation
        confirmed: true,
      };
    }
  }

  #transformTRC20Tx(tx) {
    const isIncoming = tx.to === this.#getAddress();
    return {
      id: tx.transaction_id,
      from: tx.from,
      to: tx.to,
      amount: isIncoming ? tx.value : `-${tx.value}`,
      timestamp: tx.block_timestamp,
      fee: 0,
      isIncoming,
      // TODO confirmation
      confirmed: true,
      token: this.#crypto.address,
    };
  }

  async createTx(address, value) {
    if (!address) {
      throw new Error('Invalid address');
    }
    if (!Address.isValid(address)) {
      throw new Error('Invalid address');
    }
    if (this.#getAddress() === address) {
      throw new Error('Destination address equal source address');
    }
    const amount = new BigNumber(value, 10);
    /*
    if (amount.isLessThan(this.#dustThreshold)) {
      const error = new Error('Invalid value');
      error.dustThreshold = this.#dustThreshold.toString(10);
      throw error;
    }
    */
    // TODO transfer token fee calculation
    if (this.#crypto.type !== 'token' && this.#balance.isLessThan(amount.plus(this.#minerFee))) {
      throw new Error('Insufficient funds');
    }
    const token = this.#crypto.type === 'token' ? this.#crypto.address : '_';
    const tx = buildTransferTransaction(token, this.#getAddress(), address, amount.toString(10));
    return {
      wallet: this,
      tx,
      to: address,
      amount: amount.negated().toString(10),
      total: amount,
      timestamp: new Date(),
      fee: this.#minerFee.toString(10),
      isIncoming: false,
      confirmed: false,
      async sign() {
        this.tx = await this.wallet.signTx(tx);
        return this;
      },
    };
  }

  async signTx(tx) {
    const latestBlock = await this.#getLatestBlock();
    const txWithRef = addRef(tx, latestBlock);
    const signedTx = sign(this.#privateKey.toString('hex'), txWithRef);
    return signedTx;
  }

  async sendTx(transaction) {
    const res = await this.#requestNode({
      url: 'api/v1/transaction/submit',
      method: 'post',
      data: {
        transaction: transaction.tx.hex,
      },
    });
    this.#balance = this.#balance.minus(transaction.total);
    this.#calculateMaxAmounts();
    return res;
  }

  txUrl(txId) {
    if (this.#useTestNetwork) {
      return `https://shasta.tronscan.org/#/transaction/${txId}`;
    } else {
      return `https://tronscan.org/#/transaction/${txId}`;
    }
  }

  exportPrivateKeys() {
    return `address,privatekey\n${this.#getAddress()},${this.#privateKey.toString('hex')}`;
  }
}
