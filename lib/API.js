export default class API {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  async coinBalance(address) {
    const { balance } = await this.#wallet.requestNode({
      url: `api/v1/account/${address}/balance`,
      method: 'GET',
    });
    return balance;
  }

  async tokenBalance(address, token) {
    const { balance } = await this.#wallet.requestNode({
      url: `api/v1/account/${address}/trc20/${token}/balance`,
      method: 'GET',
    });
    return balance;
  }

  async latestBlock() {
    const latestBlock = await this.#wallet.requestNode({
      url: 'api/v1/latestblock',
      method: 'GET',
    });
    return {
      blockID: latestBlock.blockID,
      blockNumber: latestBlock.number,
      blockTimestamp: latestBlock.timestamp,
    };
  }

  async chainpaPameters() {
    const parameters = await this.#wallet.requestNode({
      url: 'api/v1/chainparameters',
      method: 'GET',
    });
    return {
      getTransactionFee: 1000,
      getEnergyFee: 420,
      getCreateAccountFee: 100000,
      getCreateNewAccountFeeInSystemContract: 1000000,
      ...parameters,
    };
  }

  async account(address) {
    const data = await this.#wallet.requestNode({
      url: `api/v1/account/${address}`,
      method: 'GET',
    });
    return data;
  }

  async resources(address) {
    const data = await this.#wallet.requestNode({
      url: `api/v1/account/${address}/resources`,
      method: 'GET',
    });
    return data;
  }

  async estimateEnergy(token, from, to, value) {
    const { energy } = await this.#wallet.requestNode({
      url: `api/v1/estimateenergy/${token}`,
      method: 'GET',
      params: {
        from,
        to,
        value,
      },
    });
    return energy;
  }

  async submitTransaction(transaction) {
    const res = await this.#wallet.requestNode({
      url: 'api/v1/transaction/submit',
      method: 'POST',
      data: {
        transaction,
      },
    });
    return res;
  }

  async loadTransactions(address, limit, cursor) {
    const res = await this.#wallet.requestNode({
      url: `api/v1/account/${address}/transactions`,
      method: 'GET',
      params: {
        limit,
        fingerprint: cursor,
      },
    });
    return res;
  }

  async loadTokenTransactions(address, token, limit, cursor) {
    const res = await this.#wallet.requestNode({
      url: `api/v1/account/${address}/trc20/${token}/transactions`,
      method: 'GET',
      params: {
        limit,
        fingerprint: cursor,
      },
    });
    return res;
  }
}
