const Level0Resources = artifacts.require("Level0Resources");
const OrderBook = artifacts.require("OrderBook");
const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const toHex = web3.utils.toHex;
const fromHex = web3.utils.hexToUtf8;

contract("Level0Resources Contract", function (accounts) {
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
    orderbookInstance = await OrderBook.new("Test Level 1 Resource", 2001);
    contractInstance = await Level0Resources.new(orderbookInstance.address);
    const level0ResourceIdentifiers = [demoaHex, demobHex, democHex, demodHex];
    const level0ResourceSupplies = [1000000, 1000000, 1000000, 1000000];
    const level0ResourceMins = [0, 0, 0, 0];
    const level0ResourceMaxes = [100000000, 100000000, 100000000, 100000000];

    await contractInstance.addAllLevel0Resources(level0ResourceIdentifiers, level0ResourceSupplies, level0ResourceMins, level0ResourceMaxes);
  });

  describe("Instantiation and Level0Resource Management", function () {
    it("has level0Resources", async () => {
      const level0Resources = await contractInstance.getLevel0Resources();

      assert.equal(fromHex(level0Resources[0].identifier), demoaString, "Wrong Level0Resource identifier");
      assert.equal(fromHex(level0Resources[1].identifier), demobString, "Wrong Level0Resource identifier");
      assert.equal(level0Resources[0].supply, 1000000, "Wrong supply amount");
      assert.equal(level0Resources[1].supply, 1000000, "Wrong supply amount");
    });

    it("can be allocated", async () => {
      await contractInstance.allocate(demobHex, ALICE_WA1, 30000);
      const balance1 = await contractInstance.getBalanceForLevel0Resource(ALICE_WA0, demoaHex);
      const balance2 = await contractInstance.getBalanceForLevel0Resource(ALICE_WA1, demobHex);
      assert.equal(balance1, 0, "Wrong allocation on unallocated level 0 water resource system");
      assert.equal(balance2, 30000, "Wrong allocation on level 0 water resource system");
    });

    it("can be allocated all at once", async () => {
      await contractInstance.allocateAll([demoaHex, demobHex], [ALICE_WA0, ALICE_WA1], [20000, 30000]);
      const balance1 = await contractInstance.getBalanceForLevel0Resource(ALICE_WA0, demoaHex);
      const balance2 = await contractInstance.getBalanceForLevel0Resource(ALICE_WA1, demobHex);
      assert.equal(balance1, 20000, "Wrong allocation on level 0 water resource system");
      assert.equal(balance2, 30000, "Wrong allocation on level 0 water resource system");
    });

    xit("triggers allocation event", async () => {
      const { tx } = await contractInstance.allocate(demoaHex, ALICE_WA0, 20000);
      await expectEvent.inTransaction(tx, orderbookInstance.address, "Allocation");
    });
  });

  describe("Credits and Debits", function () {
    it("can debit", async () => {
      const level0ResourcesBefore = await contractInstance.getLevel0Resources();
      await contractInstance.allocate(demoaHex, ALICE_WA0, 30000);
      const balanceBefore = await contractInstance.getBalanceForLevel0Resource(ALICE_WA0, demoaHex);
      await contractInstance.debit(demoaHex, ALICE_WA0, 2500);
      const level0ResourcesAfter = await contractInstance.getLevel0Resources();
      const balanceAfter = await contractInstance.getBalanceForLevel0Resource(ALICE_WA0, demoaHex);

      assert.equal(Number(balanceBefore), 30000, "Amount not set correctly");
      assert.equal(Number(balanceAfter), 27500, "Amount not correctly reduced");
      assert.equal(Number(level0ResourcesBefore[0].supply), 1000000, "Supply not set correctly");
      assert.equal(Number(level0ResourcesAfter[0].supply), 997500, "Supply not correctly reduced");
    });

    xit("triggers debit event", async () => {
      await contractInstance.allocate(demoaHex, ALICE_WA0, 20000);
      const tx = await contractInstance.debit(demoaHex, ALICE_WA0, 2500);
      expectEvent(tx, "BalanceUpdated");
    });

    it("rejects invalid debit", async () => {
      await contractInstance.allocate(demoaHex, ALICE_WA0, 2000);
      expectRevert(contractInstance.debit(demoaHex, ALICE_WA0, 2500), "Balance not available");
    });

    it("can credit", async () => {
      const level0ResourcesBefore = await contractInstance.getLevel0Resources();
      await contractInstance.allocate(demoaHex, ALICE_WA0, 30000);
      const balanceBefore = await contractInstance.getBalanceForLevel0Resource(ALICE_WA0, demoaHex);
      await contractInstance.credit(demoaHex, ALICE_WA0, 2500);
      const level0ResourcesAfter = await contractInstance.getLevel0Resources();
      const balanceAfter = await contractInstance.getBalanceForLevel0Resource(ALICE_WA0, demoaHex);

      assert.equal(Number(balanceBefore), 30000, "Amount not set correctly");
      assert.equal(Number(balanceAfter), 32500, "Amount not correctly reduced");
      assert.equal(Number(level0ResourcesBefore[0].supply), 1000000, "Supply not set correctly");
      assert.equal(Number(level0ResourcesAfter[0].supply), 1002500, "Supply not correctly reduced");
    });

    xit("triggers credit event", async () => {
      const tx = await contractInstance.credit(demoaHex, ALICE_WA0, 2500);
      expectEvent(tx, "BalanceUpdated");
    });
  });
});
