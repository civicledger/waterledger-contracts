const Token = artifacts.require("AUD");

contract("AUD", function(accounts) {

  const OWNER = accounts[0];
  const ALICE = accounts[1];
  const BOB = accounts[2];

  let contractInstance;

  describe('Contract with zero AUD', () => {

    beforeEach(async () => ( contractInstance = await Token.new(0) ) );
    
    it("total supply should be 0", async function () {
      const actual = await contractInstance.totalSupply();
      assert.equal(Number(actual), 0, "Total supply should be 0");
    });
  
    it("owner balance should be 0", async function () {
      const actual = await contractInstance.balanceOf(OWNER);
      assert.equal(Number(actual), 0, "Balance should be 0");
    });
  
    it("should mint 2000 tokens", async function () {
      await contractInstance.mint(2000);
      const balance = await contractInstance.balanceOf(OWNER);
      assert.equal(Number(balance), 2000, "Balance should be 2000");
    });

    it("should mint 1000 tokens to bob", async function () {
      await contractInstance.mintTo(1000, BOB);
      const balance = await contractInstance.balanceOf(BOB);
      assert.equal(Number(balance), 1000, "Balance should be 1000");
    });
  });
  
  describe('Contract with 2000 AUD', () => {

    beforeEach(async () => ( contractInstance = await Token.new(2000) ) );
  
    it("should burn 10 tokens", async function () {
      await contractInstance.burn(10);

      const balance = await contractInstance.balanceOf(OWNER);
      assert.equal(Number(balance), 1990, "Balance should be 1990");
    });

    it("should transfer 1337 tokens to alice", async function () {
      await contractInstance.transfer(ALICE, 1337);

      let balance = await contractInstance.balanceOf(OWNER);
      assert.equal(Number(balance), 663, "Balance should be 653");

      balance = await contractInstance.balanceOf(ALICE);
      assert.equal(Number(balance), 1337, "Balance should be 1337");
    });

    it("owner should allow alice to transfer 100 tokens to bob", async () => {
      //account 0 (owner) approves alice
      await contractInstance.approve(ALICE, 100);

      //account 0 (owner) now transfers from alice to bob
      await contractInstance.transferFrom(OWNER, BOB, 100, {from: ALICE});
      const balance = await contractInstance.balanceOf(BOB);
      assert.equal(Number(balance), 100, "Balance should be 100");
    });
  });
});