const Zones = artifacts.require("Zones");
const OrderBook = artifacts.require("OrderBook");
const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const toHex = web3.utils.toHex;
const fromHex = web3.utils.hexToUtf8;

contract("Zones Contract", function (accounts) {
  var contractInstance;
  var orderbookInstance;

  const ALICE_WA0 = toHex("AL-000");
  const ALICE_WA1 = toHex("AL-001");

  const demoaString = "barron-a";
  const demobString = "barron-b";
  const democString = "barron-c";
  const demodString = "barron-d";

  const demoaHex = toHex(demoaString);
  const demobHex = toHex(demobString);
  const democHex = toHex(democString);
  const demodHex = toHex(demodString);

  // const AMOUNT = 2000;

  beforeEach(async () => {
    orderbookInstance = await OrderBook.new("Test Scheme", 2001);
    contractInstance = await Zones.new(orderbookInstance.address);
    const zoneIdentifiers = [demoaHex, demobHex, democHex, demodHex];
    const zoneSupplies = [1000000, 1000000, 1000000, 1000000];
    const zoneMins = [0, 0, 0, 0];
    const zoneMaxes = [100000000, 100000000, 100000000, 100000000];

    await contractInstance.addAllZones(zoneIdentifiers, zoneSupplies, zoneMins, zoneMaxes);
  });

  describe("Instantiation and Zone Management", function () {
    it("has zones", async () => {
      const zones = await contractInstance.getZones();

      assert.equal(fromHex(zones[0].identifier), demoaString, "Wrong Zone identifier");
      assert.equal(fromHex(zones[1].identifier), demobString, "Wrong Zone identifier");
      assert.equal(zones[0].supply, 1000000, "Wrong supply amount");
      assert.equal(zones[1].supply, 1000000, "Wrong supply amount");
    });

    it("can be allocated", async () => {
      await contractInstance.allocate(demobHex, ALICE_WA1, 30000);
      const balance1 = await contractInstance.getBalanceForZone(ALICE_WA0, demoaHex);
      const balance2 = await contractInstance.getBalanceForZone(ALICE_WA1, demobHex);
      assert.equal(balance1, 0, "Wrong allocation on unallocated zone");
      assert.equal(balance2, 30000, "Wrong allocation on zone");
    });

    it("can be allocated all at once", async () => {
      await contractInstance.allocateAll([demoaHex, demobHex], [ALICE_WA0, ALICE_WA1], [20000, 30000]);
      const balance1 = await contractInstance.getBalanceForZone(ALICE_WA0, demoaHex);
      const balance2 = await contractInstance.getBalanceForZone(ALICE_WA1, demobHex);
      assert.equal(balance1, 20000, "Wrong allocation on zone");
      assert.equal(balance2, 30000, "Wrong allocation on zone");
    });

    it("triggers allocation event", async () => {
      const tx = await contractInstance.allocate(demoaHex, ALICE_WA0, 20000);
      expectEvent(tx, "Allocation");
    });
  });

  describe("Credits and Debits", function () {
    it("can debit", async () => {
      const zonesBefore = await contractInstance.getZones();
      await contractInstance.allocate(demoaHex, ALICE_WA0, 30000);
      const balanceBefore = await contractInstance.getBalanceForZone(ALICE_WA0, demoaHex);
      await contractInstance.debit(demoaHex, ALICE_WA0, 2500);
      const zonesAfter = await contractInstance.getZones();
      const balanceAfter = await contractInstance.getBalanceForZone(ALICE_WA0, demoaHex);

      assert.equal(Number(balanceBefore), 30000, "Amount not set correctly");
      assert.equal(Number(balanceAfter), 27500, "Amount not correctly reduced");
      assert.equal(Number(zonesBefore[0].supply), 1000000, "Supply not set correctly");
      assert.equal(Number(zonesAfter[0].supply), 997500, "Supply not correctly reduced");
    });

    it("triggers debit event", async () => {
      await contractInstance.allocate(demoaHex, ALICE_WA0, 20000);
      const tx = await contractInstance.debit(demoaHex, ALICE_WA0, 2500);
      expectEvent(tx, "Debit");
    });

    it("rejects invalid debit", async () => {
      await contractInstance.allocate(demoaHex, ALICE_WA0, 2000);
      expectRevert(contractInstance.debit(demoaHex, ALICE_WA0, 2500), "Balance not available");
    });

    it("can credit", async () => {
      const zonesBefore = await contractInstance.getZones();
      await contractInstance.allocate(demoaHex, ALICE_WA0, 30000);
      const balanceBefore = await contractInstance.getBalanceForZone(ALICE_WA0, demoaHex);
      await contractInstance.credit(demoaHex, ALICE_WA0, 2500);
      const zonesAfter = await contractInstance.getZones();
      const balanceAfter = await contractInstance.getBalanceForZone(ALICE_WA0, demoaHex);

      assert.equal(Number(balanceBefore), 30000, "Amount not set correctly");
      assert.equal(Number(balanceAfter), 32500, "Amount not correctly reduced");
      assert.equal(Number(zonesBefore[0].supply), 1000000, "Supply not set correctly");
      assert.equal(Number(zonesAfter[0].supply), 1002500, "Supply not correctly reduced");
    });

    it("triggers credit event", async () => {
      const tx = await contractInstance.credit(demoaHex, ALICE_WA0, 2500);
      expectEvent(tx, "Credit");
    });
  });
});
