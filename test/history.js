const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const { BN, expectEvent } = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const toHex = web3.utils.toHex;
const fromHex = web3.utils.hexToUtf8;

contract("History", function (accounts) {
  const ALICE = accounts[1];
  const BOB = accounts[2];

  const ID1 = "0x4a7c1f2f4459c8612f032744e256027f";
  const ID2 = "0xea9aed45045352acb9667fbb5a712ea2";

  const demoaString = "barron-a";
  const demobString = "barron-a";
  const democString = "barron-a";
  const demodString = "barron-a";

  const demoaHex = toHex(demoaString);
  const demobHex = toHex(demobString);
  const democHex = toHex(democString);
  const demodHex = toHex(demodString);

  describe("Trade History", async () => {
    let contractInstance;
    let orderbookInstance;

    beforeEach(async () => {
      const beforeAmount = new BN(await web3.eth.getBalance(accounts[0]));
      orderbookInstance = await OrderBook.new("Test Scheme", 2021);
      const afterAmount = new BN(await web3.eth.getBalance(accounts[0]));
      console.log(orderbookInstance.transaction);
      console.log(afterAmount);
      console.log(beforeAmount.sub(afterAmount).toString());
      console.log(await web3.eth.getGasPrice());
      // console.log(web3.utils.fromWei(`${beforeAmount - afterAmount}`, "ether") + " ETH");
      contractInstance = await History.new(orderbookInstance.address);
    });

    const historyPrice = 500;
    const historyQuantity = 500;

    it.only("Should return a list of history", async () => {
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);

      let history = await contractInstance.getHistory(5);
      assert.equal(history.length, 3, "Should be returning three history items");
    });

    it("Should allow partial returning of history", async () => {
      // buyer, seller, price, quantity, fromZone, toZone, buyIndex, sellIndex
      await contractInstance.addHistory(BOB, ALICE, 1, 3, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, 2, 2, demoaHex, demobHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, 3, 5, demobHex, demodHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, 4, 1, demodHex, demobHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, 5, 4, demobHex, democHex, ID1);

      const numberOfHistory = 3;

      const history = await contractInstance.getHistory(numberOfHistory);

      assert.equal(history.length, numberOfHistory, "An incorrect number of history items is being returned");
    });

    it("Should handle requesting a larger number of history items than its length", async () => {
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);

      const history = await contractInstance.getHistory(5);
      assert.equal(history.length, 3, "An incorrect number of history items is being returned");
    });

    it("Properly handles an empty history", async () => {
      const history = await contractInstance.getHistory(5);
      assert.equal(history.length, 0, "An incorrect number of history items is being returned");
    });

    it("should get the history for a specified licence address", async () => {
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(ALICE, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(ALICE, BOB, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(ALICE, accounts[2], historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(BOB, accounts[2], historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(accounts[2], accounts[3], historyPrice, historyQuantity, demoaHex, demoaHex, ID1);

      const history = await contractInstance.getLicenceHistory(ALICE);
      assert.equal(history.length, 5, "Alice should have 5 history items");
    });

    it("should allow specified licence address", async () => {
      await contractInstance.addHistory(BOB, ALICE, historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(ALICE, accounts[2], historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(BOB, accounts[2], historyPrice, historyQuantity, demoaHex, demoaHex, ID1);
      await contractInstance.addHistory(accounts[2], accounts[3], historyPrice, historyQuantity, demoaHex, demoaHex, ID1);

      const history = await contractInstance.getLicenceHistory(accounts[4]);
      assert.equal(history.length, 0, "Random user should have no history but get no error");
    });

    it("triggers HistoryAdded event", async () => {
      const receipt = await contractInstance.addHistory(BOB, ALICE, 1, 3, demoaHex, demoaHex, ID1);

      const [{ id }] = await contractInstance.getHistory(1);

      expectEvent(receipt, "HistoryAdded", {
        id,
        buyer: BOB,
        seller: ALICE,
        price: new BN(1),
        quantity: new BN(3),
        orderId: ID1,
      });
    });
  });
});
