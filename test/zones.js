const Zones = artifacts.require("Zones");
const OrderBook = artifacts.require("OrderBook");
const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("Zones Contract", function (accounts) {
  var contractInstance;
  var orderbookInstance;

  const ALICE = accounts[1];

  const ALICE_WA0 = web3.utils.toHex("AL-000");
  const ALICE_WA1 = web3.utils.toHex("AL-001");

  // const AMOUNT = 2000;

  beforeEach(async () => {
    orderbookInstance = await OrderBook.new("Test Scheme", 2001);
    contractInstance = await Zones.new(orderbookInstance.address);
    await contractInstance.addZone(web3.utils.toHex("Barron Zone A"), 1000000, 0, 100000000);
    await contractInstance.addZone(web3.utils.toHex("Barron Zone B"), 1000000, 0, 100000000);
  });

  describe("Instantiation and Zone Management", function () {
    it("has zones", async () => {
      const zones = await contractInstance.getZones();
      assert.equal(web3.utils.hexToUtf8(zones[0].name), "Barron Zone A", "Wrong Zone name");
      assert.equal(web3.utils.hexToUtf8(zones[1].name), "Barron Zone B", "Wrong Zone name");
      assert.equal(zones[0].supply, 1000000, "Wrong supply amount");
      assert.equal(zones[1].supply, 1000000, "Wrong supply amount");
    });

    it("can be allocated", async () => {
      await contractInstance.allocate(1, ALICE_WA1, 30000);
      const balance1 = await contractInstance.getBalanceForZone(ALICE_WA0, 0);
      const balance2 = await contractInstance.getBalanceForZone(ALICE_WA1, 1);
      assert.equal(balance1, 0, "Wrong allocation on unallocated zone");
      assert.equal(balance2, 30000, "Wrong allocation on zone");
    });

    it("triggers allocation event", async () => {
      const tx = await contractInstance.allocate(0, ALICE_WA0, 20000);
      expectEvent(tx, "Allocation");
    });

    xit("can get all balances", async () => {
      await contractInstance.allocate(1, ALICE_WA1, 30000);
      const [balance1, balance2] = await contractInstance.getBalances(ALICE);
      assert.equal(balance1, 0, "Wrong allocation on unallocated zone");
      assert.equal(balance2, 30000, "Wrong allocation on zone");
    });
  });

  describe("Credits and Debits", function () {
    it("can debit", async () => {
      const [zoneBefore] = await contractInstance.getZones();
      await contractInstance.allocate(0, ALICE_WA0, 30000);
      const balanceBefore = await contractInstance.getBalanceForZone(ALICE_WA0, 0);
      await contractInstance.debit(0, ALICE_WA0, 2500);
      const [zoneAfter] = await contractInstance.getZones();
      const balanceAfter = await contractInstance.getBalanceForZone(ALICE_WA0, 0);

      assert.equal(Number(balanceBefore), 30000, "Amount not set correctly");
      assert.equal(Number(balanceAfter), 27500, "Amount not correctly reduced");
      assert.equal(Number(zoneBefore.supply), 1000000, "Supply not set correctly");
      assert.equal(Number(zoneAfter.supply), 997500, "Supply not correctly reduced");
    });

    it("triggers debit event", async () => {
      await contractInstance.allocate(0, ALICE_WA0, 20000);
      const tx = await contractInstance.debit(0, ALICE_WA0, 2500);
      expectEvent(tx, "Debit");
    });

    it("rejects invalid debit", async () => {
      await contractInstance.allocate(0, ALICE_WA0, 2000);
      expectRevert(contractInstance.debit(0, ALICE_WA0, 2500), "Balance not available");
    });

    it("can credit", async () => {
      const [zoneBefore] = await contractInstance.getZones();
      await contractInstance.allocate(0, ALICE_WA0, 30000);
      const balanceBefore = await contractInstance.getBalanceForZone(ALICE_WA0, 0);
      await contractInstance.credit(0, ALICE_WA0, 2500);
      const [zoneAfter] = await contractInstance.getZones();
      const balanceAfter = await contractInstance.getBalanceForZone(ALICE_WA0, 0);

      assert.equal(Number(balanceBefore), 30000, "Amount not set correctly");
      assert.equal(Number(balanceAfter), 32500, "Amount not correctly reduced");
      assert.equal(Number(zoneBefore.supply), 1000000, "Supply not set correctly");
      assert.equal(Number(zoneAfter.supply), 1002500, "Supply not correctly reduced");
    });

    it("triggers credit event", async () => {
      const tx = await contractInstance.credit(0, ALICE_WA0, 2500);
      expectEvent(tx, "Credit");
    });
  });
});
