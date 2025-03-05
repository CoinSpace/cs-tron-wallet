/* eslint-disable max-len */
import assert from 'assert/strict';
import fs from 'fs/promises';
import sinon from 'sinon';

import { Amount } from '@coinspace/cs-common';
import Wallet, { TronTransaction } from '@coinspace/cs-tron-wallet';

// either dismiss upset disease clump hazard paddle twist fetch tissue hello buyer
const RANDOM_SEED = Buffer.from('3e818cec5efc7505369fae3f162af61130b673fa9b40e5955d5cde22a85afa03748d074356a281a5fc1dbd0b721357c56095a54de8d4bc6ecaa288f300776ae4', 'hex');
const RANDOM_PUBLIC_KEY = {
  settings: {
    bip44: "m/44'/195'/0'",
  },
  data: '042a8c26a5b8a90ee32bb6ee88ea653dec6bb61ace5c53a70f09405b6cf3181b1773a3b50117e3669caffdf6b4792edd5be4a59af84f3f995e3b446d360048a695',
};

const TRANSACTION = '0a83010a0260a822089eb14248ba1a9c5c40808ef1c892305a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a154174a02d09dc08f660d2b62a1db6a1663b02a8c2371215411a41bdbc52411415d212afe9efc63cf6b8abb4171880897a9001e09143124165f339721ca614d432687fbbe55d6f4b4e12a9ef82b19790373fab9d29f172299659a337d2b32f5a5563040ce2bb77f614f654c0271ea79163edd9456daefd3f00';
const TRANSACTION_TRC20 = '0acc010a0260a822089eb14248ba1a9c5c40808ef1c892305aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a154174a02d09dc08f660d2b62a1db6a1663b02a8c237121541a614f803b6fd780986a42c78ec9c7f77e6ded13c2244a9059cbb0000000000000000000000001a41bdbc52411415d212afe9efc63cf6b8abb41700000000000000000000000000000000000000000000000000000000001e84809001e886d7051241831d562e9dbd83c9805b16df85f5a7a8a920b49486eefead4700cdbd99ba3063ce1fd4b77a5e78d3a68b10632d21665f3a96ba063bcaa2c69004f27ae7dcfa2c01';

const TRANSACTIONS = JSON.parse(await fs.readFile('./test/fixtures/transactions.json'));
const TRANSACTIONS_TRC20 = JSON.parse(await fs.readFile('./test/fixtures/transactions-trc20.json'));

const WALLET_ADDRESS = 'TLbsGXhkHe5jr37KNUKBfYETqSmQtRMceb';
const DESTIONATION_ADDRESS = 'TCN3Kpdp9FTE244dnDu5jGSxsPSYuDzh6o';

const LATEST_BLOCKHASH = {
  blockID: '00000000019a60a89eb14248ba1a9c5c2cb4b6a21f769f4ae6b75ba19607e76a',
  number: 26894504,
  timestamp: 1654251828000,
};

const CHAIN_PARAMETERS = {
  getTransactionFee: 1000,
  getEnergyFee: 420,
  getCreateAccountFee: 100000,
  getCreateNewAccountFeeInSystemContract: 1000000,
};

const tronATtron = {
  _id: 'tron@tron',
  platform: 'tron',
  decimals: 6,
  type: 'coin',
};
const tetherATtron = {
  _id: 'tether@tron',
  asset: 'tether',
  platform: 'tron',
  address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  decimals: 6,
  type: 'token',
};

let defaultOptionsCoin;
let defaultOptionsToken;

describe('Tron Wallet', () => {
  beforeEach(() => {
    defaultOptionsCoin = {
      crypto: tronATtron,
      platform: tronATtron,
      cache: { get() {}, set() {} },
      settings: {},
      request(...args) { console.log(args); },
      apiNode: 'node',
      storage: { get() {}, set() {}, save() {} },
      txPerPage: 5,
    };

    defaultOptionsToken = {
      crypto: tetherATtron,
      platform: tronATtron,
      cache: { get() {}, set() {} },
      settings: {},
      request(...args) { console.log(args); },
      apiNode: 'node',
      storage: { get() {}, set() {}, save() {} },
      txPerPage: 5,
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('create wallet instance (coin)', () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      assert.equal(wallet.state, Wallet.STATE_CREATED);
    });

    it('create wallet instance (token)', () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      assert.equal(wallet.state, Wallet.STATE_CREATED);
      assert.equal(wallet.tokenUrl, 'https://tronscan.org/#/contract/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    });

    it('wallet should have tokenUrl static method', () => {
      const url = Wallet.tokenUrl('tron', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', false);
      assert.equal(url, 'https://tronscan.org/#/contract/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    });
  });

  describe('create wallet', () => {
    it('should create new wallet with seed (coin)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(RANDOM_SEED);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, WALLET_ADDRESS);
    });

    it('should create new wallet with seed (token)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.create(RANDOM_SEED);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, WALLET_ADDRESS);
    });

    it('should fails without seed', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await assert.rejects(async () => {
        await wallet.create();
      }, {
        name: 'TypeError',
        message: 'seed must be an instance of Uint8Array or Buffer, undefined provided',
      });
    });
  });

  describe('open wallet', () => {
    it('should open wallet with public key (coin)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, WALLET_ADDRESS);
    });

    it('should open wallet with public key (token)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, WALLET_ADDRESS);
    });

    it('should fails without public key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await assert.rejects(async () => {
        await wallet.open();
      }, {
        name: 'TypeError',
        message: 'publicKey must be an instance of Object with data property',
      });
    });
  });

  describe('storage', () => {
    it('should load initial balance from storage (coin)', async () => {
      sinon.stub(defaultOptionsCoin.storage, 'get')
        .withArgs('balance').returns('1234567890');
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      assert.equal(wallet.balance.value, 1234567890n);
    });

    it('should load initial balance from storage (token)', async () => {
      sinon.stub(defaultOptionsToken.storage, 'get')
        .withArgs('balance').returns('1234567890');
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      assert.equal(wallet.balance.value, 1234567890n);
    });
  });

  describe('load', () => {
    it('should load wallet (coin)', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 504_000000 });
      const storage = sinon.mock(defaultOptionsCoin.storage);
      storage.expects('set').once().withArgs('balance', '504000000');
      storage.expects('save').once();
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      assert.equal(wallet.state, Wallet.STATE_LOADED);
      assert.equal(wallet.balance.value, 504000000n);
      storage.verify();
    });

    it('should load wallet (token)', async () => {
      sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 504_000000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/trc20/${tetherATtron.address}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 6_000000 });
      const storage = sinon.mock(defaultOptionsToken.storage);
      storage.expects('set').once().withArgs('balance', '6000000');
      storage.expects('save').once();
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();
      assert.equal(wallet.state, Wallet.STATE_LOADED);
      assert.equal(wallet.balance.value, 6000000n);
      storage.verify();
    });

    it('should set STATE_ERROR on error', async () => {
      sinon.stub(defaultOptionsCoin, 'request');
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await assert.rejects(async () => {
        await wallet.load();
      });
      assert.equal(wallet.state, Wallet.STATE_ERROR);
    });
  });

  describe('getPublicKey', () => {
    it('should export public key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(RANDOM_SEED);
      const publicKey = wallet.getPublicKey();
      assert.deepEqual(publicKey, RANDOM_PUBLIC_KEY);
    });

    it('public key is valid', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(RANDOM_SEED);
      const publicKey = wallet.getPublicKey();
      const secondWalet = new Wallet({
        ...defaultOptionsCoin,
      });
      secondWalet.open(publicKey);
      assert.equal(wallet.address, secondWalet.address);
    });
  });

  describe('getPrivateKey', () => {
    it('should export private key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(RANDOM_SEED);
      const privateKey = wallet.getPrivateKey(RANDOM_SEED);
      assert.deepEqual(privateKey, [{
        address: WALLET_ADDRESS,
        privatekey: '3a13fde504087fb821c75b798b2f18fa9dc45644bb2c3b700b0df514f557125b',
      }]);
    });
  });

  describe('validators', () => {
    describe('validateAddress', () => {
      let wallet;
      beforeEach(async () => {
        sinon.stub(defaultOptionsCoin, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 50_4000000 });
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
        await wallet.load();
      });

      it('valid address', async () => {
        assert.ok(await wallet.validateAddress({ address: DESTIONATION_ADDRESS }));
      });

      it('empty address', async () => {
        await assert.rejects(async () => {
          await wallet.validateAddress({ address: '' });
        }, {
          name: 'EmptyAddressError',
          message: 'Empty address',
        });
      });

      it('invalid address', async () => {
        await assert.rejects(async () => {
          await wallet.validateAddress({ address: '123' });
        }, {
          name: 'InvalidAddressError',
          message: 'Invalid address "123"',
        });
      });

      it('own address', async () => {
        await assert.rejects(async () => {
          await wallet.validateAddress({ address: WALLET_ADDRESS });
        }, {
          name: 'DestinationEqualsSourceError',
          message: 'Destination address equals source address',
        });
      });
    });

    describe('validateAmount (coin)', () => {
      let wallet;
      beforeEach(async () => {
        sinon.stub(defaultOptionsCoin, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 10_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/chainparameters',
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves(CHAIN_PARAMETERS);
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
        await wallet.load();
      });

      it('should be valid amount', async () => {
        const valid = await wallet.validateAmount({
          address: DESTIONATION_ADDRESS,
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
        assert.ok(valid);
      });

      it('throw on small amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: DESTIONATION_ADDRESS,
            amount: new Amount(0n, wallet.crypto.decimals),
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(1n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: DESTIONATION_ADDRESS,
            amount: new Amount(100_000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(10_000000n, wallet.crypto.decimals),
        });
      });
    });

    describe('validateAmount (token)', () => {
      let wallet;
      let request;
      beforeEach(async () => {
        request = sinon.stub(defaultOptionsToken, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 10_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/trc20/${tetherATtron.address}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 6_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/estimateenergy/${tetherATtron.address}`,
            params: sinon.match.any,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ energy: 14910 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/chainparameters',
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves(CHAIN_PARAMETERS);
        wallet = new Wallet({
          ...defaultOptionsToken,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
        await wallet.load();
      });

      it('should be valid amount', async () => {
        const valid = await wallet.validateAmount({
          address: DESTIONATION_ADDRESS,
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
        assert.ok(valid);
      });

      it('throw on small amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: DESTIONATION_ADDRESS,
            amount: new Amount(0n, wallet.crypto.decimals),
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(1n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: DESTIONATION_ADDRESS,
            amount: new Amount(100_000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(6_000000n, wallet.crypto.decimals),
        });
      });

      it('throw on insufficient coins', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 0 });
        await wallet.load();

        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: DESTIONATION_ADDRESS,
            amount: new Amount(2_000000n, wallet.crypto.decimals),
          });
        }, {
          name: 'InsufficientCoinForTransactionFeeError',
          message: 'Insufficient funds to pay the transaction fee',
          amount: new Amount(6_262200n, wallet.platform.decimals),
        });
      });
    });

    describe('estimateTransactionFee (coin)', () => {
      let wallet;
      let request;
      beforeEach(async () => {
        request = sinon.stub(defaultOptionsCoin, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 10_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/chainparameters',
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves(CHAIN_PARAMETERS);
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
      });

      it('should estimate transaction fee to new account', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
          }).resolves(undefined)
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
          }).resolves({ freeNetLimit: 1500 });
        await wallet.load();

        const fee = await wallet.estimateTransactionFee({
          address: DESTIONATION_ADDRESS,
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
        assert.deepEqual(fee, new Amount(1_100000n, wallet.crypto.decimals));
      });

      it('should estimate transaction fee to old account', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500 });
        await wallet.load();

        const fee = await wallet.estimateTransactionFee({
          address: DESTIONATION_ADDRESS,
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
        assert.deepEqual(fee, new Amount(0n, wallet.crypto.decimals));
      });

      it('should estimate transaction fee to old account without free net', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500, freeNetUsed: 1500 });
        await wallet.load();

        const fee = await wallet.estimateTransactionFee({
          address: DESTIONATION_ADDRESS,
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
        assert.deepEqual(fee, new Amount(265000n, wallet.crypto.decimals));
      });
    });

    describe('estimateTransactionFee (token)', () => {
      let wallet;
      let request;
      beforeEach(async () => {
        request = sinon.stub(defaultOptionsToken, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 10_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/trc20/${tetherATtron.address}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 6_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/chainparameters',
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves(CHAIN_PARAMETERS)
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/estimateenergy/${tetherATtron.address}`,
            params: sinon.match.any,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ energy: 28362 });
        wallet = new Wallet({
          ...defaultOptionsToken,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
      });

      it('should estimate transaction fee', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500 });
        await wallet.load();

        const fee = await wallet.estimateTransactionFee({
          address: DESTIONATION_ADDRESS,
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
        assert.deepEqual(fee, new Amount(11_912040n, wallet.crypto.decimals));
      });

      it('should estimate transaction fee without free net', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500, freeNetUsed: 1500 });
        await wallet.load();

        const fee = await wallet.estimateTransactionFee({
          address: DESTIONATION_ADDRESS,
          amount: new Amount(2_000000n, wallet.crypto.decimals),
        });
        assert.deepEqual(fee, new Amount(12_250040n, wallet.crypto.decimals));
      });
    });

    describe('estimateMaxAmount (coin)', () => {
      let wallet;
      let request;
      beforeEach(async () => {
        request = sinon.stub(defaultOptionsCoin, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 10_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/chainparameters',
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves(CHAIN_PARAMETERS);
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
      });

      it('should correct estimate max amount to new accoint', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves(undefined)
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500 });
        await wallet.load();

        const maxAmount = await wallet.estimateMaxAmount({ address: DESTIONATION_ADDRESS });
        assert.equal(maxAmount.value, 8_900000n);
      });

      it('should correct estimate max amount to old accoint', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500 });
        await wallet.load();

        const maxAmount = await wallet.estimateMaxAmount({ address: DESTIONATION_ADDRESS });
        assert.equal(maxAmount.value, 10_000000n);
      });

      it('should correct estimate max amount to old accoint without free net', async () => {
        request
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500, freeNetUsed: 1500 });
        await wallet.load();

        const maxAmount = await wallet.estimateMaxAmount({ address: DESTIONATION_ADDRESS });
        assert.equal(maxAmount.value, 9_734000n);
      });
    });

    describe('estimateMaxAmount (token)', () => {
      it('should correct estimate max amount (token)', async () => {
        sinon.stub(defaultOptionsToken, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 10_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/trc20/${tetherATtron.address}/balance`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 6_000000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/chainparameters',
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves(CHAIN_PARAMETERS)
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/estimateenergy/${tetherATtron.address}`,
            params: sinon.match.any,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ energy: 28362 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${DESTIONATION_ADDRESS}`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ balance: 123 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/account/${WALLET_ADDRESS}/resources`,
            baseURL: 'node',
            headers: sinon.match.object,
          }).resolves({ freeNetLimit: 1500 });
        const wallet = new Wallet({
          ...defaultOptionsToken,
        });
        await wallet.open(RANDOM_PUBLIC_KEY);
        await wallet.load();

        const maxAmount = await wallet.estimateMaxAmount({ address: DESTIONATION_ADDRESS });
        assert.equal(maxAmount.value, 6_000000n);
      });
    });
  });

  describe('createTransaction', () => {
    it('should create valid transaction (coin)', async () => {
      const request = sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 10_000000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${DESTIONATION_ADDRESS}`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 123 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/resources`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ freeNetLimit: 1500 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/chainparameters',
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves(CHAIN_PARAMETERS)
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/latestblock',
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves(LATEST_BLOCKHASH)
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/submit',
          data: {
            transaction: TRANSACTION,
          },
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ code: 'SUCCESS', txid: '123456' });
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        address: DESTIONATION_ADDRESS,
        amount: new Amount(2_000000, wallet.crypto.decimals),
      }, RANDOM_SEED);
      assert.equal(wallet.balance.value, 8_000000n);
      assert.equal(request.withArgs({
        seed: 'device',
        method: 'POST',
        url: 'api/v1/transaction/submit',
        data: {
          transaction: TRANSACTION,
        },
        baseURL: 'node',
        headers: sinon.match.object,
      }).callCount, 1);
      assert.equal(id, '123456');
    });

    it('should create valid transaction (token)', async () => {
      const request = sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 10_000000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/trc20/${tetherATtron.address}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 6_000000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/estimateenergy/${tetherATtron.address}`,
          params: sinon.match.any,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ energy: 28362 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${DESTIONATION_ADDRESS}`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 123 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/resources`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ freeNetLimit: 1500 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/chainparameters',
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves(CHAIN_PARAMETERS)
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/latestblock',
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves(LATEST_BLOCKHASH)
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/submit',
          data: {
            transaction: TRANSACTION_TRC20,
          },
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ code: 'SUCCESS', txid: '123456' });
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const id = await wallet.createTransaction({
        address: DESTIONATION_ADDRESS,
        amount: new Amount(2_000000, wallet.crypto.decimals),
      }, RANDOM_SEED);
      assert.equal(wallet.balance.value, 4_000000n);
      assert.equal(request.withArgs({
        seed: 'device',
        method: 'POST',
        url: 'api/v1/transaction/submit',
        data: {
          transaction: TRANSACTION_TRC20,
        },
        baseURL: 'node',
        headers: sinon.match.object,
      }).callCount, 1);
      assert.equal(id, '123456');
    });
  });

  describe('loadTransactions', () => {
    it('should load transactions (coin)', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 10_000000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/transactions`,
          params: sinon.match.object,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves(TRANSACTIONS);
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const res = await wallet.loadTransactions();
      assert.strictEqual(res.hasMore, true);
      assert.strictEqual(res.transactions.length, 5);
      assert.strictEqual(res.transactions[0].action, TronTransaction.ACTION_TRANSFER);
      assert.strictEqual(res.transactions[1].action, TronTransaction.ACTION_TOKEN_TRANSFER);
      assert.strictEqual(res.cursor, 'T6atjwJHXYTfMuvCdsZ6RScw8vrRgbF5QaDfpjYWYJhVpKdAQBvMaC68G2mXN7tsrCe9Uvd7ceYJay4EAXVc3UDM6d11sg');
    });

    it('should load transactions (token)', async () => {
      sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 10_000000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/trc20/${tetherATtron.address}/balance`,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves({ balance: 6_000000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/account/${WALLET_ADDRESS}/trc20/${tetherATtron.address}/transactions`,
          params: sinon.match.object,
          baseURL: 'node',
          headers: sinon.match.object,
        }).resolves(TRANSACTIONS_TRC20);
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(RANDOM_PUBLIC_KEY);
      await wallet.load();

      const res = await wallet.loadTransactions();
      assert.strictEqual(res.hasMore, true);
      assert.strictEqual(res.transactions.length, 5);
      assert.strictEqual(res.cursor, 'T6atjwJHXYTfMuvCdsZ6RScw8vrRgbF5QaDfpjYWYJhMLXj5GVyHJ17VoUwX2DifwzLwqLXkmv2Ew1js5WmRXFTKnHnPhV');
    });
  });
});
