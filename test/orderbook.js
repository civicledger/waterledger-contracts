const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const Zone = artifacts.require("Zone");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const zoneName = "Barron Zone A";
const zoneNameB = "Barron Zone B";
const zoneNameC = "Barron Zone C";
const zoneNameD = "Barron Zone D";
const zoneNameE = "Barron Zone E";

var contractInstance;
var zoneInstance;
var historyInstance;

const statuses = ["Pending", "Completed", "Rejected", "Invalid"];

contract("OrderBook", function (accounts) {
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

    it("has a year string", async () => {
      const year = await contractInstance.getYear();
      assert.equal(Number(year), 2021, "Scheme year is not returned correctly");
    });
  });

  describe("OrderBook limit buys", () => {
    it("can place a buy order that is unmatched", async () => {
      const buysBefore = await contractInstance.getOrderBookBuys();
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });
      const buysAfter = await contractInstance.getOrderBookBuys();

      assert.equal(buysBefore.length, 0, "Buys should not have any entries");
      assert.equal(buysAfter.length, 1, "Buys should have a single entry after placing order");
      assert.equal(buysAfter[0].owner, BOB, "Buy order should belong to Bob");
    });

    it("cannot get an order with an invalid id", async () => {
      const testId = "0x4920686176652031303021";
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });
      const buys = await contractInstance.getOrderBookBuys();
      assert.equal(buys.length, 1, "Buys should have one entry");

      expectRevert(contractInstance.getOrderById(testId), "The ID provided is not valid");
    });

    it("can place a buy order and get the order by id", async () => {
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });
      const buys = await contractInstance.getOrderBookBuys();
      const buy = await contractInstance.getOrderById(buys[0].id);

      assert.equal(buy.owner, BOB, "Buy order should belong to Bob");
      assert.equal(buy.id, buys[0].id, "Buy order should have the right ID");
    });

    it("can place a buy order that is matched", async () => {
      await zoneInstance.allocate(ALICE, 100);

      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      const tx = await contractInstance.acceptOrder(id, 0, { from: ALICE });
      expectEvent(tx, "OrderAccepted");

      const history = await historyInstance.getHistory(10);
      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
    });

    it("cannot accept buying orders from the seller", async () => {
      await zoneInstance.allocate(BOB, 100);
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      expectRevert(contractInstance.acceptOrder(id, 0, { from: BOB }), "You cannot accept your own order");
    });

    it("can be accepted across zones", async () => {
      await zoneInstance1.allocate(ALICE, 100);

      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      await contractInstance.acceptOrder(id, 1, { from: ALICE });
      const history = await historyInstance.getHistory(10);

      assert.equal(history.length, 1, "Status should be set as Pending");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(history[0].buyer, BOB, "Buyer should be Bob");
      assert.equal(history[0].seller, ALICE, "Seller should be Alice");
      assert.equal(history[0].fromZone, "1", "From Zone incorrect");
      assert.equal(history[0].toZone, "0", "To Zone incorrect");
      assert.equal(history[0].orderId, id, "Buy Id is not correct");
    });
  });

  describe("OrderBook limit sells", () => {
    it("can place a sell order - unmatched", async () => {
      await zoneInstance.allocate(ALICE, 100);
      const balanceBefore = await zoneInstance.balanceOf(ALICE);

      await contractInstance.addSellLimitOrder(sellLimitPrice, defaultSellQuantity, 0, { from: ALICE });

      const balanceAfter = await zoneInstance.balanceOf(ALICE);

      assert.equal(Number(balanceAfter), Number(balanceBefore) - defaultSellQuantity, "Balance not correctly reduced");

      const sellsAfter = await contractInstance.getOrderBookSells();
      assert.equal(sellsAfter.length, 1, "Sells should have a single entry");
      assert.equal(sellsAfter[0].owner, ALICE, "Sell order should belong to Alice");
    });

    it("can accept a sell order", async () => {
      await zoneInstance.allocate(ALICE, 300);
      await contractInstance.addSellLimitOrder(100, 50, 0, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();

      const tx = await contractInstance.acceptOrder(id, 0, { from: BOB });
      expectEvent(tx, "OrderAccepted", { orderId: id, buyer: BOB });

      const sellsAfter = await contractInstance.getOrderBookSells();
      assert.equal(0, sellsAfter.length, "There should be no unmatched sell");
    });

    it("can place multiple sell orders", async () => {
      await zoneInstance.allocate(ALICE, 300);
      const balanceBefore = await zoneInstance.balanceOf(ALICE);

      await contractInstance.addSellLimitOrder(100, 50, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(200, 40, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(123, 30, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(321, 20, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(222, 10, 0, { from: ALICE });

      const balanceAfter = await zoneInstance.balanceOf(ALICE);

      assert.equal(Number(balanceAfter), 150, "Balance not correctly reduced");
      const sellsAfter = await contractInstance.getOrderBookSells();

      assert.equal(sellsAfter.length, 5, "Sells should have 5 entries");
    });

    it("can place a sell order that is then accepted", async () => {
      const lastTradedPriceBefore = await contractInstance.getLastTradedPrice();

      await zoneInstance.allocate(ALICE, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: ALICE });
      const sells = await contractInstance.getOrderBookSells();

      await contractInstance.acceptOrder(sells[0].id, 0, { from: BOB });
      const sellsAfter = await contractInstance.getOrderBookSells();
      const history = await historyInstance.getHistory(10);

      const lastTradedPriceAfter = await contractInstance.getLastTradedPrice();

      assert.equal(lastTradedPriceBefore, 0, "There should not be any stats before a trade");
      assert.equal(Number(lastTradedPriceAfter), buyLimitPrice, "The stats are not updated correctly");
      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(sellsAfter.length, 0, "Sells should have no entries after match");
    });
  });

  describe("Cross zone transfers", () => {
    it("can match across zones", async () => {
      await zoneInstance.allocate(ALICE, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(id, 1, { from: BOB });

      const buysAfter = await contractInstance.getOrderBookBuys();
      const sellsAfter = await contractInstance.getOrderBookSells();
      const history = await historyInstance.getHistory(10);

      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].buyer, BOB, "Buyer should be BOB");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(history[0].fromZone, "0", "From Zone is incorrect");
      assert.equal(history[0].toZone, "1", "To Zone is incorrect");
      assert.equal(buysAfter.length, 0, "Buys should have no entries after match");
      assert.equal(sellsAfter.length, 0, "Sells should have no entries after match");
    });

    it("can be completed across zones", async () => {
      await zoneInstance.allocate(ALICE, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(id, 1, { from: BOB });
      const history = await historyInstance.getHistory(1);

      const beforeBalance = await zoneInstance1.balanceOf(BOB);
      await contractInstance.completeTrade(history[0].id);
      const afterBalance = await zoneInstance1.balanceOf(BOB);

      assert.equal(Number(history.length), 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(beforeBalance, 0, "Balance before transfer should be zero");
      assert.equal(afterBalance, defaultBuyQuantity, "Balance after transfer is not correct");
    });
  });

  describe("Matches that cannot be filled", () => {
    it("Should NOT attempt to match multiple orders", async () => {
      await zoneInstance2.allocate(ALICE, 500);
      await zoneInstance2.allocate(BOB, 200);
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addBuyLimitOrder(110, 60, 2, { from: BOB });

      const history = await historyInstance.getHistory(10);
      const buysAfter = await contractInstance.getOrderBookBuys();
      const sellsAfter = await contractInstance.getOrderBookSells();

      assert.equal(history.length, 0, "History should have no entries");
      assert.equal(buysAfter.length, 1, "Buys should have one entry");
      assert.equal(sellsAfter.length, 4, "Sells should have one entry");
    });
  });

  describe("Transfer Limits", () => {
    // Zone Min/Max reference
    // zoneInstance = 0, 1000;
    // zoneInstance1 = 0, 1000;
    // zoneInstance2 = 0, 1000;
    // zoneInstance3 = 500, 1000;
    // zoneInstance4 = 800, 1000;

    it("should store transfer limit maximum and minimum", async () => {
      const limits = await zoneInstance2.getTransferLimits();
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
      await zoneInstance2.allocate(ALICE, 2000);
      await contractInstance.addSellLimitOrder(100, 1500, 2, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(orderId, 2, { from: BOB });

      const [{ id, status }] = await historyInstance.getHistory(1);
      await contractInstance.validateTrade(id);

      assert.equal(statuses[status], "Pending", "Validation not correctly working");
    });

    it("should not error on a correct cross zone transfer", async () => {
      await zoneInstance2.allocate(ALICE, 2000);
      await contractInstance.addSellLimitOrder(100, 800, 2, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(orderId, 3, { from: BOB });
      const [{ id, status }] = await historyInstance.getHistory(1);

      await contractInstance.validateTrade(id);

      assert.equal(statuses[status], "Pending", "Validation not correctly working");
    });

    it("should unmatch if maximum is exceeded", async () => {
      await zoneInstance2.allocate(ALICE, 2000);
      await contractInstance.addSellLimitOrder(100, 1200, 2, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(orderId, 3, { from: BOB });
      const buysBefore = await contractInstance.getOrderBookBuys();
      const sellsBefore = await contractInstance.getOrderBookSells();
      const [{ id }] = await historyInstance.getHistory(1);

      const receipt = await contractInstance.validateTrade(id);
      expectEvent(receipt, "OrderUnmatched", { orderId });

      const buysAfter = await contractInstance.getOrderBookBuys();
      const sellsAfter = await contractInstance.getOrderBookSells();

      const [{ status }] = await historyInstance.getHistory(1);

      assert.equal(buysBefore.length, 0, "Buys should have no entries");
      assert.equal(sellsBefore.length, 0, "Sells should have no entries");
      assert.equal(statuses[status], "Invalid", "validation not correctly invalidating");
      assert.equal(buysAfter.length, 0, "Buys should have no entries");
      assert.equal(sellsAfter.length, 1, "Sells should have one entry");
    });

    it("should error if minimum is exceeded", async () => {
      await zoneInstance3.allocate(ALICE, 600);
      const orderQuantity = 150;
      const buysBefore = await contractInstance.getOrderBookBuys();
      const sellsBefore = await contractInstance.getOrderBookSells();

      await contractInstance.addSellLimitOrder(100, orderQuantity, 3, { from: ALICE });
      await contractInstance.addBuyLimitOrder(110, orderQuantity, 1, { from: BOB });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(orderId, 1, { from: BOB });

      const validFrom = await zoneInstance3.isFromTransferValid(orderQuantity);
      const validTo = await zoneInstance1.isToTransferValid(orderQuantity);

      assert.ok(validTo, "To transfer should be valid");
      assert.ok(!validFrom, "From transfer should NOT be valid");

      const [{ id }] = await historyInstance.getHistory(1);

      const receipt = await contractInstance.validateTrade(id);
      expectEvent(receipt, "OrderUnmatched", { orderId });

      const buysAfter = await contractInstance.getOrderBookBuys();
      const sellsAfter = await contractInstance.getOrderBookSells();

      const [{ status }] = await historyInstance.getHistory(1);

      assert.equal(buysBefore.length, 0, "Buys should have no entries");
      assert.equal(sellsBefore.length, 0, "Sells should have no entries");
      assert.equal(statuses[status], "Invalid", "validation not correctly invalidating");
      assert.equal(buysAfter.length, 1, "Buys should have an entry");
      assert.equal(sellsAfter.length, 1, "Sells should have one entry");
    });
  });

  describe("get orders for a licence address", () => {
    it("should get the sell orders for one licence address", async () => {
      await zoneInstance2.allocate(ALICE, 200);
      await zoneInstance2.allocate(BOB, 200);
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addSellLimitOrder(110, 20, 2, { from: BOB });
      await contractInstance.addSellLimitOrder(110, 20, 2, { from: BOB });

      const sells = await contractInstance.getLicenceOrderBookSells(ALICE);
      assert.equal(sells.length, 3, "Alice should have three sell orders");
    });

    it("should get the sell orders for one licence address", async () => {
      await contractInstance.addBuyLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addBuyLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addBuyLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addBuyLimitOrder(100, 20, 2, { from: ALICE });
      await contractInstance.addBuyLimitOrder(110, 20, 2, { from: BOB });
      await contractInstance.addBuyLimitOrder(110, 20, 2, { from: BOB });
      await contractInstance.addBuyLimitOrder(110, 20, 2, { from: BOB });

      const buysAlice = await contractInstance.getLicenceOrderBookBuys(ALICE);
      const buysBob = await contractInstance.getLicenceOrderBookBuys(BOB);
      assert.equal(buysAlice.length, 4, "Alice should have four buy orders");
      assert.equal(buysBob.length, 3, "Bob should have three buy orders");
    });
  });

  describe("Events", () => {
    it("triggers an addBuyOrder event", async () => {
      const receipt = await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });

      const [{ id }] = await contractInstance.getOrderBookBuys();

      expectEvent(receipt, "OrderAdded", {
        id,
        licenceAddress: BOB,
        price: new BN(buyLimitPrice),
        quantity: new BN(defaultBuyQuantity),
        zone: new BN(0),
      });
    });

    it("triggers an addSellOrder event", async () => {
      await zoneInstance2.allocate(ALICE, 200);
      const receipt = await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();

      expectEvent(receipt, "OrderAdded", {
        id,
        licenceAddress: ALICE,
        price: new BN(100),
        quantity: new BN(20),
        zone: new BN(2),
      });
    });

    it("triggers a BuyOrderDeleted event", async () => {
      await contractInstance.addBuyLimitOrder(100, 20, 0, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      const receipt = await contractInstance.deleteOrder(id, { from: BOB });
      expectEvent(receipt, "OrderDeleted", { id });
    });

    it("triggers a SellOrderDeleted event", async () => {
      await zoneInstance2.allocate(ALICE, 200);
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      const receipt = await contractInstance.deleteOrder(id, { from: ALICE });
      expectEvent(receipt, "OrderDeleted", { id });
    });
  });

  describe("Order Deletion", () => {
    beforeEach(async () => {
      await zoneInstance.allocate(ALICE, 2000);
      await zoneInstance.allocate(BOB, 2000);
      await contractInstance.addBuyLimitOrder(110, 20, 0, { from: ALICE });
      await contractInstance.addBuyLimitOrder(120, 20, 0, { from: ALICE });
      await contractInstance.addBuyLimitOrder(130, 20, 0, { from: ALICE });
      await contractInstance.addBuyLimitOrder(140, 20, 0, { from: ALICE });
      await contractInstance.addBuyLimitOrder(150, 20, 0, { from: BOB });
      await contractInstance.addBuyLimitOrder(160, 20, 0, { from: BOB });
      await contractInstance.addBuyLimitOrder(170, 20, 0, { from: BOB });

      await contractInstance.addSellLimitOrder(110, 30, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(120, 30, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(130, 30, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(140, 30, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(150, 30, 0, { from: BOB });
      await contractInstance.addSellLimitOrder(160, 30, 0, { from: BOB });
      await contractInstance.addSellLimitOrder(170, 30, 0, { from: BOB });
    });

    it("should allow deletion of record", async () => {
      const [{ id }] = await contractInstance.getOrderBookBuys();
      await contractInstance.deleteOrder(id, { from: ALICE });
    });

    it("should count buy orders correctly", async () => {
      const buysBefore = await contractInstance.getOrderBookBuys();
      await contractInstance.deleteOrder(buysBefore[0].id, { from: ALICE });
      const buysAfter = await contractInstance.getOrderBookBuys();
      assert.equal(buysAfter.length, buysBefore.length - 1, "Incorrect number of buys");
    });

    it("should count sell orders correctly", async () => {
      const sellsBefore = await contractInstance.getOrderBookSells();
      await contractInstance.deleteOrder(sellsBefore[0].id, { from: ALICE });
      const sellsAfter = await contractInstance.getOrderBookSells();
      assert.equal(sellsAfter.length, sellsBefore.length - 1, "Incorrect number of sells");
    });

    it("should not allow deletion of a matched order", async () => {
      let buys = await contractInstance.getOrderBookBuys();
      buys = buys.filter(order => order.owner === BOB);

      await contractInstance.acceptOrder(buys[0].id, 3, { from: ALICE });

      expectRevert(contractInstance.deleteOrder(buys[0].id, { from: BOB }), "This order has been matched");
    });

    it("should not allow deletion of someone else's order", async () => {
      const [{ id }] = await contractInstance.getOrderBookBuys();
      expectRevert(contractInstance.deleteOrder(id, { from: BOB }), "You can only delete your own order");
    });
  });

  describe("Sell Order Deletion", () => {
    beforeEach(async () => {
      await zoneInstance.allocate(ALICE, 200);
    });

    it("Should managed zone balance with addition/deletion of sell limit order", async () => {
      await contractInstance.addSellLimitOrder(120, 30, 0, { from: ALICE });
      const beforeDeletion = await zoneInstance.balanceOf(ALICE);
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.deleteOrder(id, { from: ALICE });
      const afterDeletion = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(beforeDeletion), 170, "Incorrect zone balance after creating addSellLimitOrder");
      assert.equal(Number(afterDeletion), 200, "Incorrect zone balance after deleting addSellLimitOrder");
    });

    it("should manage transfer limit with addition/deletion of sell limit order", async () => {
      await contractInstance.addSellLimitOrder(120, 30, 0, { from: ALICE });

      const [{ id }] = await contractInstance.getOrderBookSells();

      const beforeDeletion = await zoneInstance.totalSupply();
      await contractInstance.deleteOrder(id, { from: ALICE });
      const afterDeletion = await zoneInstance.totalSupply();

      assert.equal(Number(beforeDeletion), 170, "totalSupply not correctly reduced whith addSellLimitOrder()");
      assert.equal(Number(afterDeletion), 200, "totalSupply not correctly increased whith deleteOrder()");
    });

    it("should allow reuse of previously held funds", async () => {
      await contractInstance.addSellLimitOrder(200, 200, 0, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.deleteOrder(id, { from: ALICE });
      const beforeReuse = await zoneInstance.totalSupply();
      await contractInstance.addSellLimitOrder(150, 150, 0, { from: ALICE });
      const [order] = await contractInstance.getOrderBookSells();

      assert.equal(Number(beforeReuse), 200, "zone balance not refunded after deletion");
      assert.equal(order.quantity, 150, "order quantity is wrong");
      assert.equal(order.price, 150, "order price is wrong");
    });
  });
});

const createOrderBook = async () => {
  contractInstance = await OrderBook.new("Test Scheme", 2021);

  zoneInstance = await Zone.new(0, zoneName, contractInstance.address, 0, 1000);
  zoneInstance1 = await Zone.new(0, zoneNameB, contractInstance.address, 0, 1000);
  zoneInstance2 = await Zone.new(0, zoneNameC, contractInstance.address, 0, 1000);
  zoneInstance3 = await Zone.new(0, zoneNameD, contractInstance.address, 500, 1000);
  zoneInstance4 = await Zone.new(0, zoneNameE, contractInstance.address, 800, 1000);

  historyInstance = await History.new(contractInstance.address);

  await contractInstance.addZone(zoneName, zoneInstance.address);
  await contractInstance.addZone(zoneNameB, zoneInstance1.address);
  await contractInstance.addZone(zoneNameC, zoneInstance2.address);
  await contractInstance.addZone(zoneNameD, zoneInstance3.address);
  await contractInstance.addZone(zoneNameE, zoneInstance4.address);

  await contractInstance.addHistoryContract(historyInstance.address);
};

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice + "", "gwei");
  return web3.utils.fromWei(gasUsedWeiPrice + "", "ether");
};
