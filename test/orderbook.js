const History = artifacts.require("History");
const OrderBook = artifacts.require("OrderBook");
const Zone = artifacts.require("Zone");
const Users = artifacts.require("Users");

const zoneName = web3.utils.utf8ToHex("Barron Zone A");

var contractInstance;
var zoneInstance;
var historyInstance;
var usersInstance;

contract.only("OrderBook", function(accounts) {

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


  describe("OrderBook limit buys", () => {

  });

  describe("OrderBook limit sells", () => {

  });

  describe("OrderBook with setup complete", () => {

  });

  describe("OrderBook with null data", () => {

  });


});

const createOrderBook = async () => {
  contractInstance = await OrderBook.new();

  zoneInstance = await Zone.new(100000, zoneName, contractInstance.address);
  historyInstance = await History.new(contractInstance.address);

  await contractInstance.addZone(zoneName, zoneInstance.address);

  await contractInstance.addHistoryContract(historyInstance.address);
}