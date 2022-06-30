const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const Zones = artifacts.require("Zones");
const Licences = artifacts.require("Licences");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { subHours, addYears, getUnixTime } = require("date-fns");

const toHex = web3.utils.toHex;
const fromHex = web3.utils.hexToUtf8;

const demoaString = "barron-a";
const demobString = "barron-b";
const democString = "barron-c";
const demodString = "barron-d";

const demoaHex = toHex(demoaString);
const demobHex = toHex(demobString);
const democHex = toHex(democString);
const demodHex = toHex(demodString);

var contractInstance;
var zonesInstance;
var historyInstance;
var licencesInstance;

const ALICE_WA0 = toHex("AL-000");
const ALICE_WA1 = toHex("AL-001");
const ALICE_WA2 = toHex("AL-002");

const BOB_WA0 = toHex("BB-000");
const BOB_WA1 = toHex("BB-001");
const BOB_WA2 = toHex("BB-002");

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
    it("has a level 1 resource string", async () => {
      const level1Resource = await contractInstance.getLevel1Resource();
      assert.equal(level1Resource, "Test Level 1 Resource", "Level 1 Resource string is not returned correctly");
    });

    it("has a year string", async () => {
      const year = await contractInstance.getYear();
      assert.equal(Number(year), 2021, "Level 1 Resource year is not returned correctly");
    });
  });

  describe("OrderBook limit buys", () => {
    it("can place a buy order that is unmatched", async () => {
      const buysBefore = await contractInstance.getOrderBookBuys();
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: BOB });
      const buysAfter = await contractInstance.getOrderBookBuys();

      assert.equal(buysBefore.length, 0, "Buys should not have any entries");
      assert.equal(buysAfter.length, 1, "Buys should have a single entry after placing order");
      assert.equal(buysAfter[0].owner, BOB, "Buy order should belong to Bob");
    });

    it("cannot get an order with an invalid id", async () => {
      const testId = "0x4920686176652031303021";
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: BOB });
      const buys = await contractInstance.getOrderBookBuys();
      assert.equal(buys.length, 1, "Buys should have one entry");

      expectRevert(contractInstance.getOrderById(testId), "The ID provided is not valid");
    });

    it("can place a buy order and get the order by id", async () => {
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: BOB });
      const buys = await contractInstance.getOrderBookBuys();
      const buy = await contractInstance.getOrderById(buys[0].id);

      assert.equal(buy.owner, BOB, "Buy order should belong to Bob");
      assert.equal(buy.id, buys[0].id, "Buy order should have the right ID");
    });

    xit("can place a buy order that is matched", async () => {
      await zonesInstance.allocate(demoaHex, ALICE_WA0, 100);

      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      const tx = await contractInstance.acceptOrder(id, demoaHex, { from: ALICE });
      expectEvent(tx, "OrderAccepted");

      const history = await historyInstance.getHistory(10);
      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
    });

    it("cannot accept buying orders from the seller", async () => {
      await zonesInstance.allocate(demoaHex, BOB_WA0, 100);
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      expectRevert(contractInstance.acceptOrder(id, demoaHex, { from: BOB }), "You cannot accept your own order");
    });

    it("can be accepted across zones", async () => {
      await zonesInstance.allocate(demobHex, ALICE_WA1, 100);

      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      await contractInstance.acceptOrder(id, demobHex, { from: ALICE });
      const history = await historyInstance.getHistory(10);

      assert.equal(history.length, 1, "Status should be set as Pending");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(history[0].buyer, BOB, "Buyer should be Bob");
      assert.equal(history[0].seller, ALICE, "Seller should be Alice");
      assert.equal(fromHex(history[0].fromZone), demobString, "From Zone incorrect");
      assert.equal(fromHex(history[0].toZone), demoaString, "To Zone incorrect");
      assert.equal(history[0].orderId, id, "Buy Id is not correct");
    });
  });

  describe("OrderBook limit sells", () => {
    it("can place a sell order - unmatched", async () => {
      await zonesInstance.allocate(demoaHex, ALICE_WA0, 100);
      const balanceBefore = await zonesInstance.getBalanceForZone(ALICE_WA0, demoaHex);

      await contractInstance.addSellLimitOrder(sellLimitPrice, defaultSellQuantity, demoaHex, { from: ALICE });

      const balanceAfter = await zonesInstance.getBalanceForZone(ALICE_WA0, demoaHex);

      assert.equal(Number(balanceAfter), Number(balanceBefore) - defaultSellQuantity, "Balance not correctly reduced");

      const sellsAfter = await contractInstance.getOrderBookSells();
      assert.equal(sellsAfter.length, 1, "Sells should have a single entry");
      assert.equal(sellsAfter[0].owner, ALICE, "Sell order should belong to Alice");
    });

    it("can accept a sell order", async () => {
      await zonesInstance.allocate(demoaHex, ALICE_WA0, 300);
      await contractInstance.addSellLimitOrder(100, 50, demoaHex, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();

      await contractInstance.acceptOrder(id, demoaHex, { from: BOB });
      //expectEvent(tx, "OrderAccepted", { orderId: id, buyer: BOB });

      const sellsAfter = await contractInstance.getOrderBookSells();
      assert.equal(0, sellsAfter.length, "There should be no unmatched sell");
    });

    it("can place multiple sell orders", async () => {
      await zonesInstance.allocate(demoaHex, ALICE_WA0, 300);
      const balanceBefore = await zonesInstance.getBalanceForZone(ALICE_WA0, demoaHex);

      await contractInstance.addSellLimitOrder(100, 50, demoaHex, { from: ALICE });
      await contractInstance.addSellLimitOrder(200, 40, demoaHex, { from: ALICE });
      await contractInstance.addSellLimitOrder(123, 30, demoaHex, { from: ALICE });
      await contractInstance.addSellLimitOrder(321, 20, demoaHex, { from: ALICE });
      await contractInstance.addSellLimitOrder(222, 10, demoaHex, { from: ALICE });

      const balanceAfter = await zonesInstance.getBalanceForZone(ALICE_WA0, demoaHex);

      assert.equal(Number(balanceAfter), 150, "Balance not correctly reduced");
      const sellsAfter = await contractInstance.getOrderBookSells();

      assert.equal(sellsAfter.length, 5, "Sells should have 5 entries");
    });

    it("can place a sell order that is then accepted", async () => {
      const lastTradedPriceBefore = await contractInstance.getLastTradedPrice();

      await zonesInstance.allocate(demoaHex, ALICE_WA0, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: ALICE });
      const sells = await contractInstance.getOrderBookSells();

      await contractInstance.acceptOrder(sells[0].id, demoaHex, { from: BOB });
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
      await zonesInstance.allocate(demoaHex, ALICE_WA0, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(id, demobHex, { from: BOB });

      const buysAfter = await contractInstance.getOrderBookBuys();
      const sellsAfter = await contractInstance.getOrderBookSells();
      const history = await historyInstance.getHistory(10);

      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].buyer, BOB, "Buyer should be BOB");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(fromHex(history[0].fromZone), demoaString, "From Zone is incorrect");
      assert.equal(fromHex(history[0].toZone), demobString, "To Zone is incorrect");
      assert.equal(buysAfter.length, 0, "Buys should have no entries after match");
      assert.equal(sellsAfter.length, 0, "Sells should have no entries after match");
    });

    it("can be completed across zones", async () => {
      await zonesInstance.allocate(demoaHex, ALICE_WA0, 100);
      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(id, demobHex, { from: BOB });
      const history = await historyInstance.getHistory(1);

      const beforeBalance = await zonesInstance.getBalanceForZone(BOB_WA1, demobHex);
      await contractInstance.completeTrade(history[0].id);
      const afterBalance = await zonesInstance.getBalanceForZone(BOB_WA1, demobHex);

      assert.equal(Number(history.length), 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
      assert.equal(beforeBalance, 0, "Balance before transfer should be zero");
      assert.equal(afterBalance, defaultBuyQuantity, "Balance after transfer is not correct");
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
    });

    it("should not be affected if there is no cross zone", async () => {
      await zonesInstance.allocate(democHex, ALICE_WA2, 2000);
      await contractInstance.addSellLimitOrder(100, 1500, democHex, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(orderId, democHex, { from: BOB });

      const [{ id, status }] = await historyInstance.getHistory(1);

      assert.equal(statuses[status], "Pending", "Validation not correctly working");
    });

    it("should not error on a correct cross zone transfer", async () => {
      await zonesInstance.allocate(democHex, ALICE_WA2, 2000);
      await contractInstance.addSellLimitOrder(100, 800, democHex, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      await contractInstance.acceptOrder(orderId, demodHex, { from: BOB });
      const [{ id, status }] = await historyInstance.getHistory(1);

      assert.equal(statuses[status], "Pending", "Validation not correctly working");
    });

    it("should reject if maximum is exceeded", async () => {
      await zonesInstance.allocate(democHex, ALICE_WA2, 800000);

      await contractInstance.addSellLimitOrder(100, 500000, democHex, { from: ALICE });
      const [{ id: orderId }] = await contractInstance.getOrderBookSells();
      expectRevert(contractInstance.acceptOrder(orderId, demodHex, { from: BOB }), "Transfer volumes are not valid");
    });
  });

  describe("Events", () => {
    xit("triggers an addBuyOrder event", async () => {
      const receipt = await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, demoaHex, { from: BOB });

      const [{ id }] = await contractInstance.getOrderBookBuys();

      expectEvent(receipt, "OrderAdded", {
        id,
        licenceAddress: BOB,
        price: new BN(buyLimitPrice),
        quantity: new BN(defaultBuyQuantity),
      });
    });

    xit("triggers an addSellOrder event", async () => {
      await zonesInstance.allocate(democHex, ALICE_WA2, 200);
      const receipt = await contractInstance.addSellLimitOrder(100, 20, democHex, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();

      expectEvent(receipt, "OrderAdded", {
        id,
        licenceAddress: ALICE,
        price: new BN(100),
        quantity: new BN(20),
      });
    });

    xit("triggers a BuyOrderDeleted event", async () => {
      await contractInstance.addBuyLimitOrder(100, 20, demoaHex, { from: BOB });
      const [{ id }] = await contractInstance.getOrderBookBuys();
      const receipt = await contractInstance.deleteOrder(id, { from: BOB });
      expectEvent(receipt, "OrderDeleted", { id });
    });

    xit("triggers a SellOrderDeleted event", async () => {
      await zonesInstance.allocate(democHex, ALICE_WA2, 200);
      await contractInstance.addSellLimitOrder(100, 20, democHex, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      const receipt = await contractInstance.deleteOrder(id, { from: ALICE });
      expectEvent(receipt, "OrderDeleted", { id });
    });
  });

  describe("Order Deletion", () => {
    beforeEach(async () => {
      await zonesInstance.allocate(demoaHex, ALICE_WA0, 2000);
      await zonesInstance.allocate(demoaHex, BOB_WA0, 2000);
      await contractInstance.addBuyLimitOrder(110, 20, demoaHex, { from: ALICE });
      await contractInstance.addBuyLimitOrder(120, 20, demoaHex, { from: ALICE });
      await contractInstance.addBuyLimitOrder(130, 20, demoaHex, { from: ALICE });
      await contractInstance.addBuyLimitOrder(140, 20, demoaHex, { from: ALICE });
      await contractInstance.addBuyLimitOrder(150, 20, demoaHex, { from: BOB });
      await contractInstance.addBuyLimitOrder(160, 20, demoaHex, { from: BOB });
      await contractInstance.addBuyLimitOrder(170, 20, demoaHex, { from: BOB });

      await contractInstance.addSellLimitOrder(110, 30, demoaHex, { from: ALICE });
      await contractInstance.addSellLimitOrder(120, 30, demoaHex, { from: ALICE });
      await contractInstance.addSellLimitOrder(130, 30, demoaHex, { from: ALICE });
      await contractInstance.addSellLimitOrder(140, 30, demoaHex, { from: ALICE });
      await contractInstance.addSellLimitOrder(150, 30, demoaHex, { from: BOB });
      await contractInstance.addSellLimitOrder(160, 30, demoaHex, { from: BOB });
      await contractInstance.addSellLimitOrder(170, 30, demoaHex, { from: BOB });
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

      await contractInstance.acceptOrder(buys[0].id, demodHex, { from: ALICE });

      expectRevert(contractInstance.deleteOrder(buys[0].id, { from: BOB }), "This order has been matched");
    });

    it("should not allow deletion of someone else's order", async () => {
      const [{ id }] = await contractInstance.getOrderBookBuys();
      expectRevert(contractInstance.deleteOrder(id, { from: BOB }), "You can only delete your own order");
    });
  });

  describe("Sell Order Deletion", () => {
    beforeEach(async () => {
      await zonesInstance.allocate(demoaHex, ALICE_WA0, 200);
    });

    it("Should manage zone balance with addition/deletion of sell limit order", async () => {
      await contractInstance.addSellLimitOrder(120, 30, demoaHex, { from: ALICE });
      const beforeDeletion = await zonesInstance.getBalanceForZone(ALICE_WA0, demoaHex);
      const [{ id }] = await contractInstance.getOrderBookSells();
      await contractInstance.deleteOrder(id, { from: ALICE });
      const afterDeletion = await zonesInstance.getBalanceForZone(ALICE_WA0, demoaHex);
      assert.equal(Number(beforeDeletion), 170, "Incorrect zone balance after creating addSellLimitOrder");
      assert.equal(Number(afterDeletion), 200, "Incorrect zone balance after deleting addSellLimitOrder");
    });

    xit("should manage transfer limit with addition/deletion of sell limit order", async () => {
      await contractInstance.addSellLimitOrder(120, 30, demoaHex, { from: ALICE });

      const [{ id }] = await contractInstance.getOrderBookSells();

      const beforeDeletion = await zonesInstance.totalSupply();
      await contractInstance.deleteOrder(id, { from: ALICE });
      const afterDeletion = await zoneInstance.totalSupply();

      assert.equal(Number(beforeDeletion), 170, "totalSupply not correctly reduced whith addSellLimitOrder()");
      assert.equal(Number(afterDeletion), 200, "totalSupply not correctly increased whith deleteOrder()");
    });

    it("should allow reuse of previously held funds", async () => {
      await contractInstance.addSellLimitOrder(200, 200, demoaHex, { from: ALICE });
      const [{ id }] = await contractInstance.getOrderBookSells();
      const beforeDelete = await zonesInstance.getBalanceForZone(ALICE_WA0, demoaHex);
      await contractInstance.deleteOrder(id, { from: ALICE });
      const afterDelete = await zonesInstance.getBalanceForZone(ALICE_WA0, demoaHex);

      // console.log(Number(beforeDelete));
      // console.log(Number(afterDelete));
      await contractInstance.addSellLimitOrder(150, 150, demoaHex, { from: ALICE });
      const [order] = await contractInstance.getOrderBookSells();

      assert.equal(Number(beforeDelete), 0, "zone balance not refunded after deletion");
      assert.equal(Number(afterDelete), 200, "zone balance not refunded after deletion");
      assert.equal(order.quantity, 150, "order quantity is wrong");
      assert.equal(order.price, 150, "order price is wrong");
    });
  });
});

const createOrderBook = async accounts => {
  contractInstance = await OrderBook.new("Test Level 1 Resource", 2021);
  zonesInstance = await Zones.new(contractInstance.address);

  const zoneIdentifiers = [toHex("barron-a"), toHex("barron-b"), toHex("barron-c"), toHex("barron-d")];
  const zoneSupplies = [1000000, 1000000, 1000000, 600000, 900000];
  const zoneMins = [0, 0, 0, 500000, 800000];
  const zoneMaxes = [100000000, 100000000, 100000000, 1000000, 1000000];

  await zonesInstance.addAllZones(zoneIdentifiers, zoneSupplies, zoneMins, zoneMaxes);

  historyInstance = await History.new(contractInstance.address);
  licencesInstance = await Licences.new(contractInstance.address);
  const start = getUnixTime(subHours(new Date(), 2));
  const end = getUnixTime(addYears(new Date(), 1));

  await licencesInstance.issue(accounts[1], toHex("WL-000001234"), start, end);

  await licencesInstance.addAllLicenceWaterAccounts(toHex("WL-000001234"), [ALICE_WA0, ALICE_WA1, ALICE_WA2], [demoaHex, demobHex, democHex]);

  await licencesInstance.issue(accounts[2], toHex("WL-000054321"), start, end);

  await licencesInstance.addAllLicenceWaterAccounts(toHex("WL-000054321"), [BOB_WA0, BOB_WA1, BOB_WA2], [demoaHex, demobHex, democHex]);

  await contractInstance.addHistoryContract(historyInstance.address);
  await contractInstance.addZonesContract(zonesInstance.address);
  await contractInstance.addLicencesContract(licencesInstance.address);
};

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice + "", "gwei");
  return web3.utils.fromWei(gasUsedWeiPrice + "", "ether");
};
