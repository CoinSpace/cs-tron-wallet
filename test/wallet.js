import fs from 'fs/promises';
import assert from 'assert';
import TronWallet from '../index.js';

// either dismiss upset disease clump hazard paddle twist fetch tissue hello buyer
// eslint-disable-next-line max-len
const RANDOM_SEED = '3e818cec5efc7505369fae3f162af61130b673fa9b40e5955d5cde22a85afa03748d074356a281a5fc1dbd0b721357c56095a54de8d4bc6ecaa288f300776ae4';
// eslint-disable-next-line max-len
const RANDOM_PUBLIC_KEY = '{"key":"042a8c26a5b8a90ee32bb6ee88ea653dec6bb61ace5c53a70f09405b6cf3181b1773a3b50117e3669caffdf6b4792edd5be4a59af84f3f995e3b446d360048a695","path":"m/44\'/195\'/0\'"}';

const TRANSACTIONS = JSON.parse(await fs.readFile('./test/fixtures/transactions.json'));
const TRANSACTIONS_TRC20 = JSON.parse(await fs.readFile('./test/fixtures/transactions-trc20.json'));

const WALLET_ADDRESS = 'TLbsGXhkHe5jr37KNUKBfYETqSmQtRMceb';
const DESTIONATION_ADDRESS = 'TCN3Kpdp9FTE244dnDu5jGSxsPSYuDzh6o';
const LATEST_BLOCKHASH = {
  blockID: '00000000019a60a89eb14248ba1a9c5c2cb4b6a21f769f4ae6b75ba19607e76a',
  number: 26894504,
  timestamp: 1654251828000,
};

const crypto = {
  _id: 'tron@tron',
  platform: 'tron',
};
const token = {
  _id: 'tether@tron',
  asset: 'tether',
  platform: 'tron',
  address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  decimals: 6,
  type: 'token',
};
const cache = { get: () => {}, set: () => {} };

function mockRequest(handlers = {}) {
  return async function(config) {
    for (const url in handlers) {
      const fullUrl = `${config.baseURL}/${config.url}`;
      if (fullUrl.startsWith(url)) {
        return handlers[url];
      }
    }
    throw new Error(`Not found "${config.url}"`);
  };
}

describe('Wallet', () => {
  describe('constructor', () => {
    it('with seed', () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest(),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      assert.strictEqual(wallet.isLocked, false);
    });

    it('with publicKey', () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest(),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      assert.strictEqual(wallet.isLocked, true);
    });
  });

  describe('lock', () => {
    it('works', () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest(),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      assert.strictEqual(wallet.isLocked, false);
      wallet.lock();
      assert.strictEqual(wallet.isLocked, true);
    });
  });

  describe('unlock', () => {
    it('works', () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest(),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      assert.strictEqual(wallet.isLocked, true);
      wallet.unlock(RANDOM_SEED);
      assert.strictEqual(wallet.isLocked, false);
    });
  });

  describe('publicKey', () => {
    it('key is valid', () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest(),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      const publicKey = wallet.publicKey();
      assert.strictEqual(publicKey, RANDOM_PUBLIC_KEY);
    });
  });

  describe('getNextAddress', () => {
    it('should return standard address by default', () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest(),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      const address = wallet.getNextAddress();
      assert.strictEqual(address, WALLET_ADDRESS);
    });
  });

  describe('balance', () => {
    it('should works with empty wallet', async () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 0 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.strictEqual(wallet.balance, '0');
    });

    it('calculates balance correct with full wallet', async () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.strictEqual(wallet.balance, '6000000');
    });

    it('calculates balance correct with locked wallet', async () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.strictEqual(wallet.balance, '6000000');
    });

    it('calculates balance correct fro TRC20 token', async () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/trc20/${token.address}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto: token,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.strictEqual(wallet.balance, '6000000');
    });
  });

  describe('estimateFees', () => {
    it('should estimate correct with empty wallet', async () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 0 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.deepStrictEqual(wallet.estimateFees('0'), [
        {
          name: 'default',
          default: true,
          estimate: '1100000',
          maxAmount: '0',
        },
      ]);
    });

    it('should estimate correct (value 0)', async () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.deepStrictEqual(wallet.estimateFees('0'), [
        {
          name: 'default',
          default: true,
          estimate: '1100000',
          maxAmount: '4900000',
        },
      ]);
    });

    it('should estimate correct (value 150000)', async () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.deepStrictEqual(wallet.estimateFees('150000'), [
        {
          name: 'default',
          default: true,
          estimate: '1100000',
          maxAmount: '4900000',
        },
      ]);
    });

    it('should estimate correct (value max amount)', async () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.deepStrictEqual(wallet.estimateFees('4900000'), [
        {
          name: 'default',
          default: true,
          estimate: '1100000',
          maxAmount: '4900000',
        },
      ]);
    });

    it('should estimate correct (value gt max amount)', async () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.deepStrictEqual(wallet.estimateFees('100000000000000'), [
        {
          name: 'default',
          default: true,
          estimate: '1100000',
          maxAmount: '4900000',
        },
      ]);
    });
  });

  describe('createTx', () => {
    let wallet;
    beforeEach(async () => {
      wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
    });

    it('should fail (small amount)', async () => {
      await assert.rejects(async () => {
        await wallet.createTx(
          DESTIONATION_ADDRESS,
          '0',
          '1100000'
        );
      }, {
        message: 'Invalid value',
      });
    });

    it('should fail (big amount)', async () => {
      await assert.rejects(async () => {
        await wallet.createTx(
          DESTIONATION_ADDRESS,
          '100000000000000',
          '1100000'
        );
      }, {
        message: 'Insufficient funds',
      });
    });

    it.skip('should fail (invalid fee)', async () => {
      await assert.rejects(async () => {
        await wallet.createTx(
          DESTIONATION_ADDRESS,
          '2000000',
          '0'
        );
      }, {
        message: 'Invalid fee',
      });
    });

    it('should create valid transaction', async () => {
      const transaction = await wallet.createTx(
        DESTIONATION_ADDRESS,
        '1500000',
        '1100000'
      );
      assert.strictEqual(transaction.to, DESTIONATION_ADDRESS);
      assert.strictEqual(transaction.amount, '-1500000');
    });

    it('should create valid transaction with max amount', async () => {
      const transaction = await wallet.createTx(
        DESTIONATION_ADDRESS,
        '4900000',
        '1100000'
      );
      assert.strictEqual(transaction.to, DESTIONATION_ADDRESS);
      assert.strictEqual(transaction.amount, '-4900000');
    });
  });

  describe('sendTx', () => {
    it('should create and send valid transaction', async () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
          'node/api/v1/latestblock': LATEST_BLOCKHASH,
          'node/api/v1/transaction/submit': '12345',
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      assert.strictEqual(wallet.balance, '6000000');

      const raw = await wallet.createTx(
        DESTIONATION_ADDRESS,
        '1500000',
        '1100000'
      );

      const transaction = await wallet.sendTx(await raw.sign());

      assert(transaction);
      assert.strictEqual(wallet.balance, '3400000');
    });
  });

  describe('loadTxs', () => {
    it('works', async () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
          [`node/api/v1/account/${WALLET_ADDRESS}/transactions`]: TRANSACTIONS,
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      const res = await wallet.loadTxs();
      assert.strictEqual(res.hasMoreTxs, true);
      assert.strictEqual(res.txs.length, 5);
    });
  });

  describe('loadTxs TRC20', () => {
    it('works', async () => {
      const wallet = new TronWallet({
        publicKey: RANDOM_PUBLIC_KEY,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/trc20/${token.address}/balance`]: { balance: 6000000 },
          [`node/api/v1/account/${WALLET_ADDRESS}/trc20/${token.address}/transactions`]: TRANSACTIONS_TRC20,
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto: token,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      const res = await wallet.loadTxs();
      assert.strictEqual(res.hasMoreTxs, true);
      assert.strictEqual(res.txs.length, 5);
    });
  });

  describe('exportPrivateKeys', () => {
    it('works', async () => {
      const wallet = new TronWallet({
        seed: RANDOM_SEED,
        request: mockRequest({
          [`node/api/v1/account/${WALLET_ADDRESS}/balance`]: { balance: 6000000 },
        }),
        apiNode: 'node',
        apiWeb: 'web',
        crypto,
        platformCrypto: crypto,
        cache,
        settings: {},
      });
      await wallet.load();
      // eslint-disable-next-line max-len
      const expected = `address,privatekey\n${WALLET_ADDRESS},3a13fde504087fb821c75b798b2f18fa9dc45644bb2c3b700b0df514f557125b`;
      assert.strictEqual(wallet.exportPrivateKeys(), expected);
    });
  });
});
