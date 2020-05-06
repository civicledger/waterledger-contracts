const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const Zone = artifacts.require("Zone");
const assertThrows = require('./helpers/TestHelpers').assertThrows;

const zoneName = "Barron Zone A";
const zoneNameB = "Barron Zone B";
const zoneNameC = "Barron Zone C";
const zoneNameD = "Barron Zone D";
const zoneNameE = "Barron Zone E";

var contractInstance;
var zoneInstance;
var historyInstance;

const BN = web3.utils.BN;

const statuses = ['Pending', 'Completed', 'Rejected', 'Invalid'];

contract.only("OrderBook", function(accounts) {

  const ALICE = accounts[1];
  const BOB = accounts[2];

  const sellLimitPrice = 334822;
  const buyLimitPrice = 234822;
  const defaultSellQuantity = 20;
  const defaultBuyQuantity = 30;

  beforeEach(async () => createOrderBook());

  describe("Orderbook Setup", () => {
    it("has a scheme string", async () => {
      const scheme = await contractInstance.getScheme();
      assert.equal(scheme, "Test Scheme", "Scheme string is not returned correctly");
    });
  });

  describe("OrderBook limit buys", () => {

    it("can place a buy order that is unmatched", async () => {
      const buysBefore = await contractInstance.getOrderBookBuys(10);
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, 2, {from: BOB});
      const buysAfter = await contractInstance.getOrderBookBuys(10);

      assert.equal(buysBefore.length, 0, "Buys should not have any entries");
      assert.equal(buysAfter.length, 1, "Buys should not have a single entries");
      assert.equal(buysAfter[0].owner, BOB, "Buy order should belong to Bob");
    });

    it("can place a buy order that is matched", async () => {
      await zoneInstance.allocate(ALICE, 100);

      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, 2, {from: BOB});
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: ALICE});

      const history = await historyInstance.getHistory(10);

      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
    });

    it("can be completed across zones", async () => {
      await zoneInstance.allocate(ALICE, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: ALICE});
      const tx = await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, 2, {from: BOB});

      const history = await historyInstance.getHistory(1);

      const beforeBalance = await zoneInstance.balanceOf(BOB);
      await contractInstance.completeTrade(0);
      const afterBalance = await zoneInstance.balanceOf(BOB);

      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(beforeBalance, 0, "History should have one entry");
      assert.equal(afterBalance, defaultBuyQuantity, "History should have one entry");
    });

  });

  describe("OrderBook limit sells", () => {

    it("can place a sell order - unmatched", async () => {
      await zoneInstance.allocate(ALICE, 100);
      const balanceBefore = await zoneInstance.balanceOf(ALICE);

      await contractInstance.addSellLimitOrder(sellLimitPrice, defaultSellQuantity, 0, {from: ALICE});
      const balanceAfter = await zoneInstance.balanceOf(ALICE);

      assert.equal(Number(balanceAfter), Number(balanceBefore) - defaultSellQuantity, "Balance not correctly reduced");

      const sellsAfter = await contractInstance.getOrderBookSells(10);

      assert.equal(sellsAfter.length, 1, "Sells should have a single entry");
      assert.equal(sellsAfter[0].owner, ALICE, "Sell order should belong to Alice");
    });

    it("can place multiple sell orders", async () => {
      await zoneInstance.allocate(ALICE, 300);
      const balanceBefore = await zoneInstance.balanceOf(ALICE);

      await contractInstance.addSellLimitOrder(100, 50, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(200, 40, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(123, 30, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(321, 20, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(222, 10, 0, {from: ALICE});

      const balanceAfter = await zoneInstance.balanceOf(ALICE);

      assert.equal(Number(balanceAfter), 150, "Balance not correctly reduced");
      const sellsAfter = await contractInstance.getOrderBookSells(10);

      assert.equal(sellsAfter.length, 5, "Sells should have 5 entries");
    });

    it("can place a sell order that is matched", async () => {
      const lastTradedPriceBefore = await contractInstance.getLastTradedPrice();

      await zoneInstance.allocate(ALICE, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, 2, {from: BOB});

      const buysAfter = await contractInstance.getOrderBookBuys(10);
      const sellsAfter = await contractInstance.getOrderBookSells(10);
      const history = await historyInstance.getHistory(10);

      const lastTradedPriceAfter = await contractInstance.getLastTradedPrice();

      assert.equal(lastTradedPriceBefore, 0, "There should not be any stats before a trade");
      assert.equal(Number(lastTradedPriceAfter), buyLimitPrice, "The stats are not updated correctly");
      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(buysAfter.length, 0, "Buys should have no entries after match");
      assert.equal(sellsAfter.length, 0, "Sells should have no entries after match");
    });
  });

  describe("Cross zone transfers", () => {

    it("can match across zones", async () => {

      await zoneInstance.allocate(ALICE, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 1, 2, {from: BOB});

      const buysAfter = await contractInstance.getOrderBookBuys(10);
      const sellsAfter = await contractInstance.getOrderBookSells(10);
      const history = await historyInstance.getHistory(10);

      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(history[0].fromZone, "0", "Status should be set as Pending");
      assert.equal(history[0].toZone, "1", "Status should be set as Pending");
      assert.equal(buysAfter.length, 0, "Buys should have no entries after match");
      assert.equal(sellsAfter.length, 0, "Sells should have no entries after match");

    });

    it("can be completed across zones", async () => {
      await zoneInstance.allocate(ALICE, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: ALICE});
      const tx = await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 1, 2, {from: BOB});

      const history = await historyInstance.getHistory(1);

      const beforeBalance = await zoneInstance2.balanceOf(BOB);
      await contractInstance.completeTrade(0);
      const afterBalance = await zoneInstance2.balanceOf(BOB);

      assert.equal(Number(history.length), 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(beforeBalance, 0, "Balance before transfer should be zero");
      assert.equal(afterBalance, defaultBuyQuantity, "Balance after transfer is not correct");
    });

  });

  describe("Matches that cannot be filled", () => {
    it("Should NOT attempt to add multiple orders", async () => {
      await zoneInstance3.allocate(ALICE, 500);
      await zoneInstance3.allocate(BOB, 200);
      await contractInstance.addSellLimitOrder(100, 20, 2, {from: ALICE});
      await contractInstance.addSellLimitOrder(100, 20, 2, {from: ALICE});
      await contractInstance.addSellLimitOrder(100, 20, 2, {from: ALICE});
      await contractInstance.addSellLimitOrder(100, 20, 2, {from: ALICE});
      await contractInstance.addBuyLimitOrder(110, 60, 2, 2, {from: BOB});

      const history = await historyInstance.getHistory(10);
      const buysAfter = await contractInstance.getOrderBookBuys(10);
      const sellsAfter = await contractInstance.getOrderBookSells(10);

      assert.equal(history.length, 0, "History should have no entries");
      assert.equal(buysAfter.length, 1, "Buys should have one entry");
      assert.equal(sellsAfter.length, 4, "Sells should have one entry");
    });
  });

  describe("Transfer Limits", () => {

    it("should store transfer limit maximum and minimum", async () => {
      const limits = await zoneInstance3.getTransferLimits();
      assert.equal(Number(limits[0]), 0, "Minimum is not correct");
      assert.equal(Number(limits[1]), 1000, "Maximum is not correct");
    });

    it("should have total supply set by allocations", async () => {
      await zoneInstance.allocate(ALICE, 500);
      await zoneInstance.allocate(BOB, 200);
      const supply = await zoneInstance.totalSupply();
      assert.equal(Number(supply), 700, "Total supply is not correctly set");
    });

    it("should not be affected if there is no cross zone", async () => {
      await zoneInstance3.allocate(ALICE, 2000);
      await contractInstance.addSellLimitOrder(100, 1500, 2, {from: ALICE});
      await contractInstance.addBuyLimitOrder(110, 1500, 2, 2, {from: BOB});

      await contractInstance.validateTrade(0);
      const trade = await historyInstance.getTradeStruct(0);

      assert.equal(statuses[trade.status], "Pending", "Validation not correctly working");
    });

    it("should not error on a correct cross zone transfer", async () => {
      await zoneInstance3.allocate(ALICE, 2000);
      await contractInstance.addSellLimitOrder(100, 800, 2, {from: ALICE});
      await contractInstance.addBuyLimitOrder(110, 800, 1, 2, {from: BOB});

      await contractInstance.validateTrade(0);

      const trade = await historyInstance.getTradeStruct(0);

      assert.equal(statuses[trade.status], "Pending", "Validation not correctly working");
    });

    xit("should revert if maximum is exceeded", async () => {
      await zoneInstance3.allocate(ALICE, 2000);
      await contractInstance.addSellLimitOrder(100, 1200, 2, {from: ALICE});
      await contractInstance.addBuyLimitOrder(110, 1200, 1, 2, {from: BOB});

      const buysBefore = await contractInstance.getOrderBookBuys(5);
      const sellsBefore = await contractInstance.getOrderBookSells(5);

      await contractInstance.validateTrade(0);

      const trade = await historyInstance.getTradeStruct(0);

      const buysAfter = await contractInstance.getOrderBookBuys(5);
      const sellsAfter = await contractInstance.getOrderBookSells(5);

      assert.equal(buysBefore.length, 0, "Buys should have no entries");
      assert.equal(sellsBefore.length, 0, "Sells should have no entries");
      assert.equal(statuses[trade.status], "Invalid", "validation not correctly invalidating");
      assert.equal(buysAfter.length, 1, "Buys should have one entry");
      assert.equal(sellsAfter.length, 1, "Sells should have one entry");

    });

    it("should error if minimum is exceeded", async () => {
      await zoneInstance4.allocate(ALICE, 600);
      await contractInstance.addSellLimitOrder(100, 150, 3, {from: ALICE});
      await contractInstance.addBuyLimitOrder(110, 150, 1, 2, {from: BOB});

      const buysBefore = await contractInstance.getOrderBookBuys(5);
      const sellsBefore = await contractInstance.getOrderBookSells(5);

      await contractInstance.validateTrade(0);

      const trade = await historyInstance.getTradeStruct(0);

      const buysAfter = await contractInstance.getOrderBookBuys(5);
      const sellsAfter = await contractInstance.getOrderBookSells(5);

      assert.equal(buysBefore.length, 0, "Buys should have no entries");
      assert.equal(sellsBefore.length, 0, "Sells should have no entries");
      assert.equal(statuses[trade.status], "Invalid", "validation not correctly invalidating");
      assert.equal(buysAfter.length, 1, "Buys should have one entry");
      assert.equal(sellsAfter.length, 1, "Sells should have one entry");
    });

  });

  describe("get orders for a licence address", () => {

    it("should get the sell orders for one licence address", async () => {
      await zoneInstance3.allocate(ALICE, 200);
      await zoneInstance3.allocate(BOB, 200);
      await contractInstance.addSellLimitOrder(100, 20, 2, {from: ALICE});
      await contractInstance.addSellLimitOrder(100, 20, 2, {from: ALICE});
      await contractInstance.addSellLimitOrder(100, 20, 2, {from: ALICE});
      await contractInstance.addSellLimitOrder(110, 20, 2, {from: BOB});
      await contractInstance.addSellLimitOrder(110, 20, 2, {from: BOB});

      const sells = await contractInstance.getLicenceOrderBookSells(ALICE, 10);
      assert.equal(sells.length, 3, "Alice should have three sell orders");

    });

    it("should get the sell orders for one licence address", async () => {
      await contractInstance.addBuyLimitOrder(100, 20, 2, 1, {from: ALICE});
      await contractInstance.addBuyLimitOrder(100, 20, 2, 1, {from: ALICE});
      await contractInstance.addBuyLimitOrder(100, 20, 2, 1, {from: ALICE});
      await contractInstance.addBuyLimitOrder(100, 20, 2, 1, {from: ALICE});
      await contractInstance.addBuyLimitOrder(110, 20, 2, 1, {from: BOB});
      await contractInstance.addBuyLimitOrder(110, 20, 2, 1, {from: BOB});
      await contractInstance.addBuyLimitOrder(110, 20, 2, 1, {from: BOB});

      const buysAlice = await contractInstance.getLicenceOrderBookBuys(ALICE, 10);
      const buysBob = await contractInstance.getLicenceOrderBookBuys(BOB, 10);
      assert.equal(buysAlice.length, 4, "Alice should have four buy orders");
      assert.equal(buysBob.length, 3, "Bob should have three buy orders");

    });

  });

  describe("Edge Cases", () => {

    it("Should allow a standard trade", async () => {
      await zoneInstance3.allocate(ALICE, 100);
      await zoneInstance3.allocate(BOB, 200);
      await contractInstance.addSellLimitOrder(100, 20, 2, {from: ALICE});
      await contractInstance.addBuyLimitOrder(110, 20, 1, 2, {from: BOB});
    });

    it("Should ignore trades by self - do not match buy order", async () => {
      await zoneInstance.allocate(ALICE, 400);
      await contractInstance.addSellLimitOrder(100, 20, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(100, 20, 0, 0, {from: ALICE});

      const history = await historyInstance.getHistory(10);
      const buysAfter = await contractInstance.getOrderBookBuys(10);
      const sellsAfter = await contractInstance.getOrderBookSells(10);

      assert.equal(history.length, 0, "History should have no entries");
      assert.equal(buysAfter.length, 1, "Buys should have one entry with no match");
      assert.equal(sellsAfter.length, 1, "Sells should have one entry with no match");
    });

    it("Should ignore trades by self - do not match sell order", async () => {
      await zoneInstance.allocate(ALICE, 400);
      await contractInstance.addBuyLimitOrder(100, 20, 0, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(100, 20, 0, {from: ALICE});

      const history = await historyInstance.getHistory(10);
      const buysAfter = await contractInstance.getOrderBookBuys(10);
      const sellsAfter = await contractInstance.getOrderBookSells(10);

      assert.equal(history.length, 0, "History should have no entries");
      assert.equal(buysAfter.length, 1, "Buys should have one entries with no match");
      assert.equal(sellsAfter.length, 1, "Sells should have one entries with no match");
    });
  });

  describe("Order Deletion", () => {

    beforeEach(async () => {
      await zoneInstance.allocate(ALICE, 2000);
      await zoneInstance.allocate(BOB, 2000);
      await contractInstance.addBuyLimitOrder(110, 20, 0, 1, {from: ALICE});
      await contractInstance.addBuyLimitOrder(120, 20, 0, 1, {from: ALICE});
      await contractInstance.addBuyLimitOrder(130, 20, 0, 1, {from: ALICE});
      await contractInstance.addBuyLimitOrder(140, 20, 0, 1, {from: ALICE});
      await contractInstance.addBuyLimitOrder(150, 20, 0, 1, {from: BOB});
      await contractInstance.addBuyLimitOrder(160, 20, 0, 1, {from: BOB});
      await contractInstance.addBuyLimitOrder(170, 20, 0, 1, {from: BOB});

      await contractInstance.addSellLimitOrder(110, 30, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(120, 30, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(130, 30, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(140, 30, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(150, 30, 0, {from: BOB});
      await contractInstance.addSellLimitOrder(160, 30, 0, {from: BOB});
      await contractInstance.addSellLimitOrder(170, 30, 0, {from: BOB});
    });

    it("should allow deletion of record", async () => {
      await contractInstance.deleteBuyOrder(2, {from: ALICE});
    });

    it("should count buy orders correctly", async () => {
      const buysBefore = await contractInstance.getOrderBookBuys(10);
      await contractInstance.deleteBuyOrder(2, {from: ALICE});
      const buysAfter = await contractInstance.getOrderBookBuys(10);
      assert.equal(buysAfter.length, buysBefore.length - 1, "Incorrect number of buys");
    });

    it("should count sell orders correctly", async () => {
      const sellsBefore = await contractInstance.getOrderBookSells(10);
      await contractInstance.deleteSellOrder(2, {from: ALICE});
      const sellsAfter = await contractInstance.getOrderBookSells(10);
      assert.equal(sellsAfter.length, sellsBefore.length - 1, "Incorrect number of sells");
    });

    it("should return the correct buy orders", async () => {
      await contractInstance.deleteBuyOrder(2, {from: ALICE});
      const buys = await contractInstance.getOrderBookBuys(10);
      assert.equal(buys[0].price, 170, "Incorrect ordering of values");
      assert.equal(buys[1].price, 160, "Incorrect ordering of values");
      assert.equal(buys[2].price, 150, "Incorrect ordering of values");
      assert.equal(buys[3].price, 140, "Incorrect ordering of values");
      assert.equal(buys[4].price, 120, "Incorrect ordering of values");
      assert.equal(buys[5].price, 110, "Incorrect ordering of values");
    });

    it("should return the correct sell orders", async () => {
      await contractInstance.deleteSellOrder(2, {from: ALICE});
      const sells = await contractInstance.getOrderBookSells(10);

      assert.equal(sells[0].price, 110, "Incorrect ordering of values");
      assert.equal(sells[1].price, 120, "Incorrect ordering of values");
      assert.equal(sells[2].price, 140, "Incorrect ordering of values");
      assert.equal(sells[3].price, 150, "Incorrect ordering of values");
      assert.equal(sells[4].price, 160, "Incorrect ordering of values");
      assert.equal(sells[5].price, 170, "Incorrect ordering of values");
    });

    it("should not allow deletion of a matched order", async () => {
      const buys = await contractInstance.getOrderBookBuys(10);

      await contractInstance.addSellLimitOrder(140, 20, 0, {from: ALICE});
      const history = await historyInstance.getHistory(10);
      const matchedBuy = history[0].buyIndex;

      assertThrows(contractInstance.deleteBuyOrder(matchedBuy, {from: BOB}), "This order has been matched");
    });

    it("should not allow deletion of someone else's order", async () => {
      assertThrows(contractInstance.deleteBuyOrder(2, {from: BOB}), "You can only delete your own order");
    });

  })
});

const createOrderBook = async () => {
  contractInstance = await OrderBook.new("Test Scheme");

  zoneInstance = await Zone.new(0, zoneName, contractInstance.address, 0, 1000);
  zoneInstance2 = await Zone.new(0, zoneNameB, contractInstance.address, 0, 1000);
  zoneInstance3 = await Zone.new(0, zoneNameC, contractInstance.address, 0, 1000);
  zoneInstance4 = await Zone.new(0, zoneNameD, contractInstance.address, 500, 1000);
  zoneInstance5 = await Zone.new(0, zoneNameE, contractInstance.address, 800, 1000);

  historyInstance = await History.new(contractInstance.address);

  await contractInstance.addZone(zoneName, zoneInstance.address);
  await contractInstance.addZone(zoneNameB, zoneInstance2.address);
  await contractInstance.addZone(zoneNameC, zoneInstance3.address);
  await contractInstance.addZone(zoneNameD, zoneInstance4.address);
  await contractInstance.addZone(zoneNameE, zoneInstance5.address);

  await contractInstance.addHistoryContract(historyInstance.address);
}

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice+'', 'gwei');
  return web3.utils.fromWei(gasUsedWeiPrice+'', 'ether');
}