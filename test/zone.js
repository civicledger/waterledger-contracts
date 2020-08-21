const Zone = artifacts.require("Zone");
const OrderBook = artifacts.require("OrderBook");

contract("Zone Contract", function (accounts) {
  var contractInstance;
  var orderbookInstance;

  const ALICE = accounts[1];

  const AMOUNT = 2000;

  beforeEach(async () => {
    orderbookInstance = await OrderBook.new("Test Scheme", 2001);
    contractInstance = await Zone.new(AMOUNT, "Barron Zone A", orderbookInstance.address, 0, 1000000);
  });

  describe("Instantiation and ERC-20 functionality", function () {
    describe("Initial supply", () => {
      it("total supply should be 2000", async function () {
        const actual = await contractInstance.totalSupply();
        assert.equal(actual, AMOUNT, `Total supply is not ${AMOUNT}`);
      });
    });

    describe("Allocation", () => {
      it("should transfer 1337 tokens to alice", async function () {
        await contractInstance.allocate(ALICE, 1337);

        const balance = await contractInstance.balanceOf(ALICE);
        assert.equal(balance, 1337, "Balance should be 1337");
      });
    });
  });
});
