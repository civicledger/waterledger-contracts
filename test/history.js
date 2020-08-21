const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const { BN, expectEvent } = require("@openzeppelin/test-helpers");

contract("History", function (accounts) {
  const ALICE = accounts[1];
  const BOB = accounts[2];
  const PERIOD_SIX_MONTHS = 2;

  describe("Trade History", async () => {
    let contractInstance;
    let orderbookInstance;

    beforeEach(async () => {
      orderbookInstance = await OrderBook.new("Test Scheme", 2021);
      contractInstance = await History.new(orderbookInstance.address);
    });

    const historyPrice = 500;
    const historyQuantity = 500;

    it("Should return a list of history", async () => {
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);

      let history = await contractInstance.getHistory(5);
      assert.equal(history.length, 3, "Should be returning three history items");
    });

    it("Should allow partial returning of history", async () => {
      // buyer, seller, price, quantity, fromZone, toZone, buyIndex, sellIndex
      await contractInstance.addHistory(BOB, ALICE, 1, 3, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, 2, 2, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, 3, 5, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, 4, 1, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, 5, 4, 0, 0, 0, 0);

      const numberOfHistory = 3;

      const history = await contractInstance.getHistory(numberOfHistory);

      assert.equal(history.length, numberOfHistory, "An incorrect number of history items is being returned");
    });

    it("Should handle requesting a larger number of history items than its length", async () => {
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);

      const history = await contractInstance.getHistory(5);
      assert.equal(history.length, 3, "An incorrect number of history items is being returned");
    });

    it("Properly handles an empty history", async () => {
      const history = await contractInstance.getHistory(5);
      assert.equal(history.length, 0, "An incorrect number of history items is being returned");
    });

    it("should get the history for a specified licence address", async () => {
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(ALICE, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(ALICE, BOB, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(ALICE, accounts[2], historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, accounts[2], historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(accounts[2], accounts[3], historyPrice, historyQuantity, 0, 0, 0, 0);

      const history = await contractInstance.getLicenceHistory(ALICE);
      assert.equal(history.length, 5, "Alice should have 5 history items");
    });

    it("should allow specified licence address", async () => {
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(ALICE, accounts[2], historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(BOB, accounts[2], historyPrice, historyQuantity, 0, 0, 0, 0);
      await contractInstance.addHistory(accounts[2], accounts[3], historyPrice, historyQuantity, 0, 0, 0, 0);

      const history = await contractInstance.getLicenceHistory(accounts[4]);
      assert.equal(history.length, 0, "Random user should have no history but get no error");
    });

    it("triggers HistoryAdded event", async () => {
      const receipt = await contractInstance.addHistory(BOB, ALICE, 1, 3, 0, 0, 0, 0);

      const trade = await contractInstance._history(0);

      expectEvent(receipt, "HistoryAdded", {
        id: trade.id,
        buyer: BOB,
        seller: ALICE,
        price: new BN(1),
        quantity: new BN(3),
        fromZone: new BN(0),
        toZone: new BN(0),
      });
    });
  });
});
