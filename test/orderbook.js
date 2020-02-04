const AUD = artifacts.require("AUD");
const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const Stats = artifacts.require("Stats");
const Zone = artifacts.require("Zone");

let AssembleStruct = require('./helpers/AssembleStruct');

const orderStructDefinition = [
  {name: 'orderType', type: 'uint256'},
  {name: 'owner', type: 'address'},
  {name: 'price', type: 'uint256'},
  {name: 'quantity', type: 'uint256'},
  {name: 'timeStamp', type: 'uint256'},
];
const zoneName = web3.utils.utf8ToHex("Barron Zone A");
const START_VOLUME = 0;

var contractInstance;
var statsInstance;
var zoneInstance;
var historyInstance;

contract("OrderBook", function(accounts) {

  const OWNER = accounts[0];
  const ALICE = accounts[1];
  const BOB = accounts[2];
  const ORDER_TYPE_SELL = 0;
  const ORDER_TYPE_BUY = 1;

  const sellLimitPrice = 334822;
  const buyLimitPrice = 234822;
  const defaultSellQuantity = 420;
  const defaultBuyQuantity = 360;

  const DEFAULT_VOLUME = 100;

  const JANUARY_1_2018 = 1514764800;
  const JANUARY_1_2020 = 1577836800;

  beforeEach(async () => createOrderBook());

  it("Should not allow Alice to make a sell order if she does not have sufficient water", async () => {
    try {
      await contractInstance.addSellLimitOrder(sellLimitPrice, defaultSellQuantity, 0, {from: ALICE});
    } catch(error) {
      assert(error);
      assert.equal(error.reason, "Insufficient water allocation", "Incorrect error for this revert");
    }
  });

  it("Should not allow Bob to make a buy order if he does not have sufficient funds", async () => {
    try {
      await contractInstance.addBuyLimitOrder(buyLimitPrice, defaultBuyQuantity, 0, {from: BOB});
    } catch(error) {
      assert(error);
      assert.equal(error.reason, "Insufficient AUD allocation", "Incorrect error for this revert");
    }
  });

  describe("OrderBook limit buys", () => {
    beforeEach(async () => {
      await createOrderBook();
      await zoneInstance.transfer(ALICE, 5000);
      await audInstance.transfer(BOB, 1000000);
    });

    it("Should add a limit buy order from Bob to an empty order book", async () => {
      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});

      let [ orderType, owner, price, quantity, timeStamp, matchedTimeStamp ] = Object.values(await contractInstance._buys(0));

      const remainingAudBalance = await audInstance.balanceOf(BOB);
      const afterSellVolume = Number(await statsInstance._volumeAvailable());

      assert.equal(afterSellVolume, START_VOLUME, "Stat volumes are not correctly updating on buy");
      assert.equal(orderType, ORDER_TYPE_BUY, "Should be an offer");
      assert.equal(owner, BOB, "Owner should be Bob");
      assert.equal(Number(remainingAudBalance), 999000, "Bobs's aud balance has not been correctly reduced");
      assert.equal(price, 10, "Buy limit amount is wrong");
      assert.equal(quantity, 100, "Incorrect quantity");
      assert.isTrue(timeStamp > 0, "Time stamp should be greater than");
      assert.equal(matchedTimeStamp, 0, "Matched time stamp should be zero on unmatched trades");
    });

    it("Should fill an entire limit buy order from Bob with exact price", async () => {
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});
      const afterSellVolume = Number(await statsInstance._volumeAvailable());
      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});
      const afterMatchVolume = Number(await statsInstance._volumeAvailable());

      let waterBalance = await zoneInstance.balanceOf(BOB);
      assert.equal(waterBalance, 100, "Water balance should be 100 ML");

      let audBalance = await audInstance.balanceOf(ALICE);
      // console.log(audBalance);
      assert.equal(audBalance, 1000, "AUD balance should be 1,000");

      waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(waterBalance, 4900, "Water balance should be 4,900 ML");

      // assert.equal(afterSellVolume, START_VOLUME + DEFAULT_VOLUME, "Stat volumes is not correct after sell order placement");
      // assert.equal(afterMatchVolume, START_VOLUME, "Stat volumes is not being reduced during match");

      const [ buyOrderType, buyOwner, buyPrice, buyQuantity, buyTimeStamp, buyMatchedTimeStamp ] = Object.values(await contractInstance._buys(0));
      assert.isFalse(buyMatchedTimeStamp.isZero(), 'Buy order matched timestamp was not set');
      const [ sellOrderType, sellOwner, sellPrice, sellQuantity, sellTimeStamp, sellMatchedTimeStamp ] = Object.values(await contractInstance._sells(0));
      assert.isFalse(sellMatchedTimeStamp.isZero(), 'Sell order matched timestamp was not set');
    });

    it("Should not fill any of buy order from Bob with lower price", async () => {
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(9, 100, 0, {from: BOB});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 0, "Sellers AUD balance should be $0");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4900, "Sellers water balance should be 4,900 ML");
    });

    it("Should fill an entire limit buy order from Bob with higher offer price", async () => {
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(11, 100, 0, {from: BOB});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 1100, "Sellers AUD balance should be $1,100");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4900, "Sellers water balance should be 4,900 ML");
    });

    it("Should not fill 100 of 200 limit buy order from Bob", async () => {
      await contractInstance.addSellLimitOrder(10, 200, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 0, "Sellers AUD balance should be $0");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4800, "Sellers water balance should be 4,800 ML");
    });

    it("Should only fill 100 of 200 limit buy order from Bob", async () => {
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});

      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 1000, "Sellers AUD balance should be $1,000");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4800, "Sellers water balance should be 4,800 ML");
    });

    it("Should only fill 100 of 300 limit buy order from Bob", async () => {
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});

      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 1000, "Sellers AUD balance should be $1,000");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4700, "Sellers water balance should be 4,700 ML");
    });

    it('Should keep matching orders', async () => {
      await contractInstance.addSellLimitOrder(10, 1, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(10, 1, 0, {from: BOB});
      await contractInstance.addSellLimitOrder(11, 2, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(11, 2, 0, {from: BOB});
    });
  });

  describe("OrderBook limit sells", () => {
    beforeEach(async () => {
      await createOrderBook();
      await zoneInstance.transfer(ALICE, 5000);
      await audInstance.transfer(BOB, 1000000);
    });

    it("Should add a limit sell order from Alice to an empty order book", async () => {

      await contractInstance.addSellLimitOrder(10, DEFAULT_VOLUME, 0, {from: ALICE});
      let [ orderType, owner, price, quantity, timeStamp, matchedTimeStamp ] = Object.values(await contractInstance._sells(0));

      const remainingAudBalance = await zoneInstance.balanceOf(ALICE);
      const afterSellVolume = Number(await statsInstance._volumeAvailable());

      // assert.equal(afterSellVolume, START_VOLUME + DEFAULT_VOLUME, "Stat volumes are not correctly updating on sell");
      assert.equal(orderType, ORDER_TYPE_SELL, "Should be an ask");
      assert.equal(owner, ALICE, "Owner should be Alice");
      assert.equal(Number(remainingAudBalance), 4900, "Alice's water balance has not been correctly reduced");
      assert.equal(price, 10, "Sell limit amount is wrong");
      assert.equal(quantity, 100, "Incorrect quantity");
      assert.isTrue(timeStamp > 0, "Time stamp should be greater than");
      assert.equal(matchedTimeStamp, 0, "Matched time stamp should be zero on unmatched trades");
    });

    it("Should fill an entire limit sell order from Alice with exact price", async () => {
      await contractInstance.addBuyLimitOrder(10, DEFAULT_VOLUME, 0, {from: BOB});
      await contractInstance.addSellLimitOrder(10, DEFAULT_VOLUME, 0, {from: ALICE});
      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 1000, "Sellers AUD balance should be $1,000");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4900, "Sellers water balance should be 4,900 ML");

      const [ buyOrderType, buyOwner, buyPrice, buyQuantity, buyTimeStamp, buyMatchedTimeStamp ] = Object.values(await contractInstance._buys(0));
      assert.isFalse(buyMatchedTimeStamp.isZero(), 'Buy order matched timestamp was not set');
      const [ sellOrderType, sellOwner, sellPrice, sellQuantity, sellTimeStamp, sellMatchedTimeStamp ] = Object.values(await contractInstance._sells(0));
      assert.isFalse(sellMatchedTimeStamp.isZero(), 'Sell order matched timestamp was not set');
    });

    it("Should not fill sell order from Alice with higher offer price", async () => {
      //Bob wishes to buy 100 ML @ $10
      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});

      //Alice is willing to sell 100 ML @ $11
      await contractInstance.addSellLimitOrder(11, 100, 0, {from: ALICE});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 0, "Sellers AUD balance should still be $0");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4900, "Sellers water balance should be 4,900 ML");
    });

    it("Should fill sell order from Alice with higher ask price", async () => {
      //Bob wishes to buy 100 ML @ $11
      await contractInstance.addBuyLimitOrder(11, 100, 0, {from: BOB});

      //Alice is willing to sell 100 ML @ $10
      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 1000, "Sellers AUD balance should be $1,000");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4900, "Sellers water balance should be 4,900 ML");
    });

    it("Should not fill any of the limit sell order from Alice with a greater quantity", async () => {
      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});
      await contractInstance.addSellLimitOrder(10, 200, 0, {from: ALICE});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 0, "Sellers AUD balance should still be $0");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4800, "Sellers water balance should be 4,800 ML");
    });

    it("Should only fill one 100 limit sell order from Alice", async () => {
      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});
      await contractInstance.addBuyLimitOrder(10, 100, 0, {from: BOB});

      await contractInstance.addSellLimitOrder(10, 100, 0, {from: ALICE});

      const audBalance = await audInstance.balanceOf(ALICE);
      assert.equal(Number(audBalance), 1000, "Sellers AUD balance should be $1,000");

      const waterBalance = await zoneInstance.balanceOf(ALICE);
      assert.equal(Number(waterBalance), 4900, "Sellers water balance should be 4,900 ML");
    });

    it('Should keep matching orders', async () => {
      await contractInstance.addBuyLimitOrder(10, 1, 0, {from: BOB});
      await contractInstance.addSellLimitOrder(10, 1, 0, {from: ALICE});
      await contractInstance.addBuyLimitOrder(11, 2, 0, {from: BOB});
      await contractInstance.addSellLimitOrder(11, 2, 0, {from: ALICE});
    });
  });

  describe("OrderBook with setup complete", () => {

    //Unsorted test data
    const testData = [
      {owner: ALICE, price: 15, quantity: 10, orderType: ORDER_TYPE_SELL},
      {owner: ALICE, price: 25, quantity: 20, orderType: ORDER_TYPE_SELL},
      {owner: ALICE, price: 20, quantity: 20, orderType: ORDER_TYPE_SELL},
      {owner: BOB, price: 10, quantity: 10, orderType: ORDER_TYPE_BUY},
      {owner: BOB, price: 5, quantity: 20, orderType: ORDER_TYPE_BUY},
      {owner: BOB, price: 7, quantity: 20, orderType: ORDER_TYPE_BUY}
    ];

    beforeEach(async () => {
      await createOrderBook();

      await zoneInstance.transfer(ALICE, 10000);
      await audInstance.transfer(BOB, 1000000);

      //Sells price quantity
      await contractInstance.addBuyLimitOrder(10, 10, 0, {from: BOB});
      await contractInstance.addBuyLimitOrder(5, 20, 0, {from: BOB});
      await contractInstance.addBuyLimitOrder(7, 20, 0, {from: BOB});

      //Buys price quantity
      //Note to future self.  This breaks because of the 10 quantity.
      //await contractInstance.addSellLimitOrder(15, 11, {from: ALICE});

      await contractInstance.addSellLimitOrder(15, 10, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(25, 20, 0, {from: ALICE});
      await contractInstance.addSellLimitOrder(20, 20, 0, {from: ALICE});
    });

    it("Should have the correct number of limit orders as non are matched", async () => {
      let orderBookData = await contractInstance.getOrderBook();
      let fixedData = AssembleStruct.assemble(orderStructDefinition, Object.values(orderBookData));

      assert.equal(fixedData.length, 6, "There should be six order limits");

      testData.forEach(({owner, price, quantity, orderType}, index) => {
        assert.equal(fixedData[index].owner, owner, `Row ${ index +1 } - Incorrect "owner" record found`);
        assert.equal(fixedData[index].price, price, `Row ${ index + 1 } - Incorrect "price" record found`);
        assert.equal(fixedData[index].quantity, quantity, `Row ${ index + 1 } - Incorrect "quantity" record found`);
        assert.equal(fixedData[index].orderType, orderType, `Row ${ index + 1 } - Incorrect "type" record found`);
      });
    });

    it("Should have three sell (ask) orders", async () => {
      let orderBookData = await contractInstance.getOrderBookSells(10);
      let fixedData = AssembleStruct.assemble(orderStructDefinition, Object.values(orderBookData));

      assert.equal(fixedData.length, 3, "There should be 3 ask order limits");

      assert.equal(fixedData[0].owner, ALICE, 'Incorrect "owner" record found');
      assert.equal(fixedData[0].price, 15, 'Incorrect "price" record found');
      assert.equal(fixedData[0].quantity, 10, 'Incorrect "quantity" record found');

      assert.equal(fixedData[1].owner, ALICE, 'Incorrect "owner" record found');
      assert.equal(fixedData[1].price, 20, 'Incorrect "price" record found');
      assert.equal(fixedData[1].quantity, 20, 'Incorrect "quantity" record found');

      assert.equal(fixedData[2].owner, ALICE, 'Incorrect "owner" record found');
      assert.equal(fixedData[2].price, 25, 'Incorrect "price" record found');
      assert.equal(fixedData[2].quantity, 20, 'Incorrect "quantity" record found');
    });

    it("Should have three sorted buy (offer) orders", async () => {
      let orderBookData = await contractInstance.getOrderBookBuys(10);
      let fixedData = AssembleStruct.assemble(orderStructDefinition, Object.values(orderBookData));

      assert.equal(fixedData.length, 3, "There should be 3 buy (offer) order limits");

      assert.equal(fixedData[0].owner, BOB, 'Incorrect "owner" record found');
      assert.equal(fixedData[0].price, 10, 'Incorrect "price" record found');
      assert.equal(fixedData[0].quantity, 10, 'Incorrect "quantity" record found');

      assert.equal(fixedData[1].owner, BOB, 'Incorrect "owner" record found');
      assert.equal(fixedData[1].price, 7, 'Incorrect "price" record found');
      assert.equal(fixedData[1].quantity, 20, 'Incorrect "quantity" record found');

      assert.equal(fixedData[2].owner, BOB, 'Incorrect "owner" record found');
      assert.equal(fixedData[2].price, 5, 'Incorrect "price" record found');
      assert.equal(fixedData[2].quantity, 20, 'Incorrect "quantity" record found');
    });

    it("Should get lowest ask", async () => {
      const [ owner, price, quantity ] = Object.values(await contractInstance.lowestSell());

      assert.equal(owner, ALICE, 'Incorrect "owner" record found');
      assert.equal(price, 15, "Lowest ask price should be 15");
      assert.equal(quantity, 10, "Lowest ask quantity should be 10");
    });

    it("Should get highest bid / offer", async () => {
      const [ owner, price, quantity ] = Object.values(await contractInstance.highestBuy());

      assert.equal(owner, BOB, 'Incorrect "owner" record found');
      assert.equal(price, 10, "Highest offer price should be 10");
      assert.equal(quantity, 10, "Higest offer quantity should be 10");
    });

    it("Should support more than 10 orders", async () => {

      for (let i = 0; i <= 8; i++) {
        await contractInstance.addBuyLimitOrder(1, 1, 0, {from: BOB});
      }

      let orderBookData = await contractInstance.getOrderBookBuys(10);
      let fixedData = AssembleStruct.assemble(orderStructDefinition, Object.values(orderBookData));

      assert.equal(fixedData.length, 10, "Ten orders should be received");
    });

  });

  describe("OrderBook with null data", () => {
    beforeEach(async () => {
      await createOrderBook();
      await zoneInstance.transfer(ALICE, 10000);
      await audInstance.transfer(BOB, 1000000);
    });

    it("Should get zero values on lowest sell", async () => {
      const [ owner, price, quantity ] = Object.values(await contractInstance.lowestSell());

      assert.equal(owner, "0x0000000000000000000000000000000000000000", 'Incorrect "owner" record found');
      assert.equal(price, 0, "Lowest ask price should be 0");
      assert.equal(quantity, 0, "Lowest ask quantity should be 0");
    });

    it("Should get zero values on highest buy", async () => {
      const [ owner, price, quantity ] = Object.values(await contractInstance.highestBuy());

      assert.equal(owner, "0x0000000000000000000000000000000000000000", 'Incorrect "owner" record found');
      assert.equal(price, 0, "Highest offer price should be 0");
      assert.equal(quantity, 0, "Highest offer quantity should be 0");
    });

    it("getOrderBookSells should not cause error on empty data", async () => {
      let orderBookData = await contractInstance.getOrderBookSells(10);
      let fixedData = AssembleStruct.assemble(orderStructDefinition, Object.values(orderBookData));

      assert.equal(fixedData.length, 0, "Sells should be empty");
    });

    it("getOrderBookBuys should not cause error on empty data", async () => {
      let orderBookData = await contractInstance.getOrderBookBuys(10);
      let fixedData = AssembleStruct.assemble(orderStructDefinition, Object.values(orderBookData));

      assert.equal(fixedData.length, 0, "Orders should be empty");
    });

  });


});

const createOrderBook = async () => {
  statsInstance = await Stats.new(START_VOLUME, 0, 0, 0, 0);
  audInstance = await AUD.new(50000000);
  zoneInstance = await Zone.new(100000, zoneName);
  historyInstance = await History.new();

  contractInstance = await OrderBook.new(audInstance.address, historyInstance.address, statsInstance.address);
  await contractInstance.addZone(zoneName, zoneInstance.address);
  await historyInstance.addWriter(contractInstance.address);
  await audInstance.setOrderBook(contractInstance.address);
  await zoneInstance.setOrderBook(contractInstance.address);
  await statsInstance.addWriter(contractInstance.address);
}