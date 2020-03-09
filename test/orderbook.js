const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const Zone = artifacts.require("Zone");
const Users = artifacts.require("Users");

const zoneName = web3.utils.utf8ToHex("Barron Zone A");
const zoneNameB = web3.utils.utf8ToHex("Barron Zone B");
const zoneNameC = web3.utils.utf8ToHex("Barron Zone C");
const zoneNameD = web3.utils.utf8ToHex("Barron Zone D");

var contractInstance;
var zoneInstance;
var historyInstance;
var usersInstance;

const BN = web3.utils.BN;

contract.only("OrderBook", function(accounts) {


  const OWNER = accounts[0];
  const ALICE = accounts[1];
  const BOB = accounts[2];
  const ORDER_TYPE_SELL = 0;
  const ORDER_TYPE_BUY = 1;

  const sellLimitPrice = 334822;
  const buyLimitPrice = 234822;
  const defaultSellQuantity = 20;
  const defaultBuyQuantity = 30;

  const DEFAULT_VOLUME = 100;

  const JANUARY_1_2018 = 1514764800;
  const JANUARY_1_2020 = 1577836800;

  beforeEach(async () => createOrderBook());


  describe("OrderBook limit buys", () => {

    it("can place a buy order that is unmatched", async () => {
      const buysBefore = await contractInstance.getOrderBookBuys(10);
      const tx = await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: BOB});
      const buysAfter = await contractInstance.getOrderBookBuys(10);
      // console.log(`${getGasCostInEth(tx)} eth`);
      assert.equal(buysBefore.length, 0, "Buys should not have any entries");
      assert.equal(buysAfter.length, 1, "Buys should not have a single entries");
      assert.equal(buysAfter[0].owner, BOB, "Buy order should belong to Bob");
    });

    it("can place a buy order that is matched", async () => {
      await zoneInstance.transfer(ALICE, 100);

      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: BOB});
      const tx = await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: ALICE});
      // console.log(`${getGasCostInEth(tx)} eth`);
      const buysAfter = await contractInstance.getOrderBookBuys(10);
      const sellsAfter = await contractInstance.getOrderBookSells(10);
      const history = await historyInstance.getHistory(10);

      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
    });

  });

  describe("OrderBook limit sells", () => {
    it("can place a sell order - unmatched", async () => {
      await zoneInstance.transfer(ALICE, 100);
      const balanceBefore = await zoneInstance.balanceOf(ALICE);

      const tx = await contractInstance.addSellLimitOrder(sellLimitPrice, defaultSellQuantity, 0, {from: ALICE});
      const balanceAfter = await zoneInstance.balanceOf(ALICE);
      // console.log(`${getGasCostInEth(tx)} eth`);
      assert.equal(Number(balanceAfter), Number(balanceBefore) - defaultSellQuantity, "Balance not correctly reduced");

      const sellsAfter = await contractInstance.getOrderBookSells(10);

      assert.equal(sellsAfter.length, 1, "Sells should not have a single entries");
      assert.equal(sellsAfter[0].owner, ALICE, "Sell order should belong to Alice");
    });

    it("can place a sell order that is matched", async () => {
      await zoneInstance.transfer(ALICE, 100);

      await contractInstance.addSellLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: ALICE});
      const tx = await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: BOB});
      // console.log(`${getGasCostInEth(tx)} eth`);
      const buysAfter = await contractInstance.getOrderBookBuys(10);
      const sellsAfter = await contractInstance.getOrderBookSells(10);
      const history = await historyInstance.getHistory(10);

      assert.equal(history.length, 1, "History should have one entry");
      assert.equal(history[0].status, "0", "Status should be set as Pending");
    });
  });

  describe("OrderBook with setup complete", () => {

  });

  describe("OrderBook with null data", () => {

  });


});

const createOrderBook = async () => {
  contractInstance = await OrderBook.new();

  zoneInstance = await Zone.new(100000, zoneName, contractInstance.address);
  zoneInstance2 = await Zone.new(100000, zoneNameB, contractInstance.address);
  zoneInstance3 = await Zone.new(100000, zoneNameC, contractInstance.address);
  zoneInstance4 = await Zone.new(100000, zoneNameD, contractInstance.address);

  historyInstance = await History.new(contractInstance.address);

  await contractInstance.addZone(zoneName, zoneInstance.address);
  await contractInstance.addZone(zoneNameB, zoneInstance2.address);
  await contractInstance.addZone(zoneNameC, zoneInstance3.address);
  await contractInstance.addZone(zoneNameD, zoneInstance4.address);

  await contractInstance.addHistoryContract(historyInstance.address);
}

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice+'', 'gwei');
  return web3.utils.fromWei(gasUsedWeiPrice+'', 'ether');
}