const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const Zones = artifacts.require("Zones");
const Licences = artifacts.require("Licences");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { subHours, addYears, getUnixTime } = require("date-fns");

const zoneName = "Barron Zone A";
const zoneNameB = "Barron Zone B";
const zoneNameC = "Barron Zone C";
const zoneNameD = "Barron Zone D";
const zoneNameE = "Barron Zone E";

var contractInstance;
var zonesInstance;
var historyInstance;
var licencesInstance;

const ALICE_WA0 = web3.utils.toHex("AL-000");
const ALICE_WA1 = web3.utils.toHex("AL-001");
const ALICE_WA2 = web3.utils.toHex("AL-002");

const BOB_WA0 = web3.utils.toHex("BB-000");
const BOB_WA1 = web3.utils.toHex("BB-001");
const BOB_WA2 = web3.utils.toHex("BB-002");

const statuses = ["Pending", "Completed", "Rejected", "Invalid"];

contract("OrderBook", function (accounts) {
  const ALICE = accounts[1];
  const BOB = accounts[2];

  const sellLimitPrice = 334822;
  const buyLimitPrice = 234822;
  const defaultSellQuantity = 20;
  const defaultBuyQuantity = 30;

  beforeEach(async () => createOrderBook(accounts));

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
      await zonesInstance.allocate(0, ALICE_WA0, 100);

      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      const tx = await contractInstance.acceptOrder(id, 0, { from: ALICE });
      expectEvent(tx, "OrderAccepted");

      const history = await historyInstance.getHistory(10);
      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
    });

    it("cannot accept buying orders from the seller", async () => {
      await zonesInstance.allocate(0, BOB_WA0, 100);
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      expectRevert(contractInstance.acceptOrder(id, 0, { from: BOB }), "You cannot accept your own order");
    });

    it("can be accepted across zones", async () => {
      await zonesInstance.allocate(1, ALICE_WA1, 100);

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
      await zonesInstance.allocate(0, ALICE_WA0, 100);
      const balanceBefore = await zonesInstance.getBalanceForZone(ALICE_WA0, 0);

      await contractInstance.addSellLimitOrder(sellLimitPrice, defaultSellQuantity, 0, { from: ALICE });

      const balanceAfter = await zonesInstance.getBalanceForZone(ALICE_WA0, 0);

      assert.equal(Number(balanceAfter), Number(balanceBefore) - defaultSellQuantity, "Balance not correctly reduced");

      const sellsAfter = await contractInstance.getOrderBookSells();
      assert.equal(sellsAfter.length, 1, "Sells should have a single entry");
      assert.equal(sellsAfter[0].owner, ALICE, "Sell order should belong to Alice");
    });

    it("can accept a sell order", async () => {
      await zonesInstance.allocate(0, ALICE_WA0, 300);
      await contractInstance.addSellLimitOrder(100, 50, 0, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();

      const tx = await contractInstance.acceptOrder(id, 0, { from: BOB });
      expectEvent(tx, "OrderAccepted", { orderId: id, buyer: BOB });

      const sellsAfter = await contractInstance.getOrderBookSells();
      assert.equal(0, sellsAfter.length, "There should be no unmatched sell");
    });

    it("can place multiple sell orders", async () => {
      await zonesInstance.allocate(0, ALICE_WA0, 300);
      const balanceBefore = await zonesInstance.getBalanceForZone(ALICE_WA0, 0);

      await contractInstance.addSellLimitOrder(100, 50, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(200, 40, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(123, 30, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(321, 20, 0, { from: ALICE });
      await contractInstance.addSellLimitOrder(222, 10, 0, { from: ALICE });

      const balanceAfter = await zonesInstance.getBalanceForZone(ALICE_WA0, 0);

      assert.equal(Number(balanceAfter), 150, "Balance not correctly reduced");
      const sellsAfter = await contractInstance.getOrderBookSells();

      assert.equal(sellsAfter.length, 5, "Sells should have 5 entries");
    });

    it("can place a sell order that is then accepted", async () => {
      const lastTradedPriceBefore = await contractInstance.getLastTradedPrice();

      await zonesInstance.allocate(0, ALICE_WA0, 100);
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

    // this test is disabled because for some reason it causes the FOLLOWING tests to fail
    xit("should error if minimum is exceeded", async () => {
      await zonesInstance.allocate(2, ALICE_WA2, 400000);
      expectRevert(contractInstance.addSellLimitOrder(100, 200000, 2, { from: ALICE }), "Debit transfer not valid");
    });
  });

  describe("Cross zone transfers", () => {
    it("can match across zones", async () => {
      await zonesInstance.allocate(0, ALICE_WA0, 100);
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
      await zonesInstance.allocate(0, ALICE_WA0, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(id, 1, { from: BOB });
      const history = await historyInstance.getHistory(1);

      const beforeBalance = await zonesInstance.getBalanceForZone(BOB_WA1, 1);
      await contractInstance.completeTrade(history[0].id);
      const afterBalance = await zonesInstance.getBalanceForZone(BOB_WA1, 1);

      assert.equal(Number(history.length), 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(beforeBalance, 0, "Balance before transfer should be zero");
      assert.equal(afterBalance, defaultBuyQuantity, "Balance after transfer is not correct");
    });
  });

  describe("Matches that cannot be filled", () => {
    it("Should NOT attempt to match multiple orders", async () => {
      await zonesInstance.allocate(2, ALICE_WA2, 500);
      await zonesInstance.allocate(2, BOB_WA2, 200);
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
      const zones = await zonesInstance.getZones();
      assert.equal(Number(zones[0].supply), 1000000, "Supply is not correct");
      assert.equal(Number(zones[0].min), 0, "Minimum is not correct");
      assert.equal(Number(zones[0].max), 100000000, "Maximum is not correct");
      assert.equal(Number(zones[1].supply), 1000000, "Supply is not correct");
      assert.equal(Number(zones[1].min), 0, "Minimum is not correct");
      assert.equal(Number(zones[1].max), 100000000, "Maximum is not correct");
      assert.equal(Number(zones[2].supply), 1000000, "Supply is not correct");
      assert.equal(Number(zones[2].min), 0, "Minimum is not correct");
      assert.equal(Number(zones[2].max), 100000000, "Maximum is not correct");
      assert.equal(Number(zones[3].supply), 600000, "Supply is not correct");
      assert.equal(Number(zones[3].min), 500000, "Minimum is not correct");
      assert.equal(Number(zones[3].max), 1000000, "Maximum is not correct");
      assert.equal(Number(zones[4].supply), 900000, "Supply is not correct");
      assert.equal(Number(zones[4].min), 800000, "Minimum is not correct");
      assert.equal(Number(zones[4].max), 1000000, "Maximum is not correct");
    });

    it("should not be affected if there is no cross zone", async () => {
      await zonesInstance.allocate(2, ALICE_WA2, 2000);
      await contractInstance.addSellLimitOrder(100, 1500, 2, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(orderId, 2, { from: BOB });

      const [{ id, status }] = await historyInstance.getHistory(1);

      assert.equal(statuses[status], "Pending", "Validation not correctly working");
    });

    it("should not error on a correct cross zone transfer", async () => {
      await zonesInstance.allocate(2, ALICE_WA2, 2000);
      await contractInstance.addSellLimitOrder(100, 800, 2, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(orderId, 3, { from: BOB });
      const [{ id, status }] = await historyInstance.getHistory(1);

      assert.equal(statuses[status], "Pending", "Validation not correctly working");
    });

    it("should reject if maximum is exceeded", async () => {
      await zonesInstance.allocate(2, ALICE_WA2, 800000);

      await contractInstance.addSellLimitOrder(100, 500000, 2, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      expectRevert(contractInstance.acceptOrder(orderId, 3, { from: BOB }), "Transfer volumes are not valid");
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
      await zonesInstance.allocate(2, ALICE_WA2, 200);
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
      await zonesInstance.allocate(2, ALICE_WA2, 200);
      await contractInstance.addSellLimitOrder(100, 20, 2, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      const receipt = await contractInstance.deleteOrder(id, { from: ALICE });
      expectEvent(receipt, "OrderDeleted", { id });
    });
  });

  describe("Order Deletion", () => {
    beforeEach(async () => {
      await zonesInstance.allocate(0, ALICE_WA0, 2000);
      await zonesInstance.allocate(0, BOB_WA0, 2000);
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
      await zonesInstance.allocate(0, ALICE_WA0, 200);
    });

    xit("Should manage zone balance with addition/deletion of sell limit order", async () => {
      await contractInstance.addSellLimitOrder(120, 30, 0, { from: ALICE });
      const beforeDeletion = await zonesInstance.getBalanceForZone(ALICE_WA0, 0);
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.deleteOrder(id, { from: ALICE });
      const afterDeletion = await zonesInstance.getBalanceForZone(ALICE_WA0, 0);
      assert.equal(Number(beforeDeletion), 170, "Incorrect zone balance after creating addSellLimitOrder");
      assert.equal(Number(afterDeletion), 200, "Incorrect zone balance after deleting addSellLimitOrder");
    });

    xit("should manage transfer limit with addition/deletion of sell limit order", async () => {
      await contractInstance.addSellLimitOrder(120, 30, 0, { from: ALICE });

      const [{ id }] = await contractInstance.getOrderBookSells();

      const beforeDeletion = await zoneInstance.totalSupply();
      await contractInstance.deleteOrder(id, { from: ALICE });
      const afterDeletion = await zoneInstance.totalSupply();

      assert.equal(Number(beforeDeletion), 170, "totalSupply not correctly reduced whith addSellLimitOrder()");
      assert.equal(Number(afterDeletion), 200, "totalSupply not correctly increased whith deleteOrder()");
    });

    xit("should allow reuse of previously held funds", async () => {
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

const createOrderBook = async accounts => {
  contractInstance = await OrderBook.new("Test Scheme", 2021);
  zonesInstance = await Zones.new(contractInstance.address);

  await zonesInstance.addZone(web3.utils.toHex(zoneName), 1000000, 0, 100000000);
  await zonesInstance.addZone(web3.utils.toHex(zoneNameB), 1000000, 0, 100000000);
  await zonesInstance.addZone(web3.utils.toHex(zoneNameC), 1000000, 0, 100000000);
  await zonesInstance.addZone(web3.utils.toHex(zoneNameD), 600000, 500000, 1000000);
  await zonesInstance.addZone(web3.utils.toHex(zoneNameE), 900000, 800000, 1000000);

  historyInstance = await History.new(contractInstance.address);
  licencesInstance = await Licences.new();
  const start = getUnixTime(subHours(new Date(), 2));
  const end = getUnixTime(addYears(new Date(), 1));

  await licencesInstance.issue(accounts[1], start, end);
  await licencesInstance.addLicenceWaterAccount(0, ALICE_WA0, 0, zoneName);
  await licencesInstance.addLicenceWaterAccount(0, ALICE_WA1, 1, zoneNameB);
  await licencesInstance.addLicenceWaterAccount(0, ALICE_WA2, 2, zoneNameC);

  await licencesInstance.issue(accounts[2], start, end);
  await licencesInstance.addLicenceWaterAccount(1, BOB_WA0, 0, zoneName);
  await licencesInstance.addLicenceWaterAccount(1, BOB_WA1, 1, zoneNameB);
  await licencesInstance.addLicenceWaterAccount(1, BOB_WA2, 2, zoneNameC);
  // addLicenceWaterAccount;

  await contractInstance.addHistoryContract(historyInstance.address);
  await contractInstance.addZonesContract(zonesInstance.address);
  await contractInstance.addLicencesContract(licencesInstance.address);
};

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice + "", "gwei");
  return web3.utils.fromWei(gasUsedWeiPrice + "", "ether");
};
