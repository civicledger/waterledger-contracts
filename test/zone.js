const assertThrows = require('./helpers/TestHelpers').assertThrows;
const Zone = artifacts.require("Zone");
const OrderBook = artifacts.require("OrderBook");

contract("Zone Contract", function(accounts) {

  var contractInstance;
  var orderbookInstance;

  const OWNER = accounts[0];
  const ALICE = accounts[1];
  const BOB = accounts[2];
  const WATER_LICENCE = accounts[9];

  const AMOUNT = 2000;

  beforeEach(async () => {
    orderbookInstance = await OrderBook.new();
    contractInstance = await Zone.new(AMOUNT, web3.utils.utf8ToHex("Barron Zone A"), orderbookInstance.address);
  });

  describe("Instantiation and ERC-20 functionality", function(){

    describe("Initial supply", () => {
      it("total supply should be 2000", async function () {
        const actual = await contractInstance.totalSupply();
        assert.equal(actual, AMOUNT, `Total supply is not ${AMOUNT}`);
      });

      it("owner balance should be 2000", async function () {
        const actual = await contractInstance.balanceOf(OWNER);
        assert.equal(actual, AMOUNT, `Owner balance is not ${AMOUNT}`);
      });
    });

    describe("Transfers", () => {

      it("should transfer 1337 tokens to alice", async function () {
        await contractInstance.transfer(ALICE, 1337);

        let balance = await contractInstance.balanceOf(OWNER);
        assert.equal(balance, 663, "Balance should be 663");

        balance = await contractInstance.balanceOf(ALICE);
        assert.equal(balance, 1337, "Balance should be 1337");
      });

      it("owner should allow alice to transfer 100 tokens to bob", async function () {
        // account 0 (owner) approves alice
        await contractInstance.transfer(ALICE, 1337);
        await contractInstance.approve(ALICE, 100);

        //account 0 (owner) now transfers from alice to bob
        await contractInstance.transferFrom(OWNER, BOB, 100, {from: ALICE});

        const balance = await contractInstance.balanceOf(BOB);
        assert.equal(balance, 100, "Balance should be 100");
      });
    });
  });

  xdescribe("Allocations", function(){

    beforeEach(async () => await contractInstance.setWaterLicence(WATER_LICENCE));

    it("only owner can set water licence", async () => {
      await assertThrows(
        contractInstance.setWaterLicence(ALICE, {from: BOB}),
        'Only the owner can perform this action'
      );
    });

    it("should allow allocation of water",  async () => {
      await contractInstance.allocate(ALICE, 123, {from: WATER_LICENCE});

      const balance = await contractInstance.balanceOf(ALICE);
      const ownerBalance = await contractInstance.balanceOf(OWNER);
      assert.equal(balance, 123, "Balance should be 123");
      assert.equal(ownerBalance, 1877, "Owner Balance should be reduced to 1877");
    });

    it("should error if random account tries to allocate water",  async () => {
      await assertThrows(
        contractInstance.allocate(ALICE, 123, {from: BOB}),
        'Only water licence can allocate water.'
      );
    });

  });

});