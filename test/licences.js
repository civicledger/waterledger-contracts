const Licences = artifacts.require("Licences");
const { expectRevert } = require("@openzeppelin/test-helpers");

contract("Licences", function (accounts) {
  let contract;
  let owner = accounts[0];
  let user1Address = accounts[1];
  let user2Address = accounts[2];
  let nonOwner = accounts[3];
  const fromDate = Math.floor(new Date().getTime() / 1000) - 20000;

  const toDate = Math.floor(Date.UTC("2022", "06", "30", "23", "59", "59") / 1000);

  beforeEach(async () => (contract = await Licences.new()));

  describe("Test gas usage", () => {
    it("runs an function with no event", async () => {
      const tx = await contract.eventTest();
      const gas = tx.receipt.gasUsed;
      console.log(gas);
    });
    it("runs an event with no arguments", async () => {
      const tx = await contract.eventTest1();
      const gas = tx.receipt.gasUsed;
      console.log(gas);
    });
    it("runs an event with one arguments", async () => {
      const tx = await contract.eventTest2();
      const gas = tx.receipt.gasUsed;
      console.log(gas);
    });
    it("runs an event with two arguments", async () => {
      const tx = await contract.eventTest3(accounts[4]);
      const gas = tx.receipt.gasUsed;
      console.log(gas);
    });
    it("runs an event with three arguments", async () => {
      const tx = await contract.eventTest4(accounts[4]);
      const gas = tx.receipt.gasUsed;
      console.log(gas);
    });
  });

  describe("Licences", function () {
    it("can add a licence", async function () {
      const licencesLength = await contract.licencesLength();
      await contract.issue(user2Address, fromDate, toDate);
      const licencesLengthAfter = await contract.licencesLength();
      assert.equal(Number(licencesLengthAfter), Number(licencesLength) + 1, "Licences length should be incremented");
    });

    it("can retrieve a licence", async function () {
      await contract.issue(user2Address, fromDate, toDate);
      const licence = await contract.getLicence(0);
      assert.equal(licence[0], user2Address, "Address is not saved successfully");
    });

    it("can check a licence", async function () {
      await contract.issue(user2Address, fromDate, toDate);
      const hasValidLicence = await contract.hasValid(user2Address);

      assert.ok(hasValidLicence, "Address not returning as valid licence");
    });
  });

  describe("water accounts", function () {
    beforeEach(async () => await contract.issue(user2Address, fromDate, toDate));

    it("can add a water account to a licence", async function () {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1);
      const waterAccount = await contract.getWaterAccountForWaterAccountId(web3.utils.toHex("WL0000002"));
      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), "WL0000002");
    });

    it("can add multiple water accounts to a licence", async function () {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1);
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000003"), 2);
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000004"), 4);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(web3.utils.toHex("WL0000004"));

      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), "WL0000004");
    });

    it("can add multiple water accounts to a licence in one step", async function () {
      await contract.addAllLicenceWaterAccounts(0, [web3.utils.toHex("WL0000002"), web3.utils.toHex("WL0000003")]);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(web3.utils.toHex("WL0000003"));
      const waterAccounts = await contract.getWaterAccountsForLicence(0);

      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), "WL0000003");
    });

    it("can add multiple water accounts to a licence in one step with sparse arrays", async function () {
      await contract.addAllLicenceWaterAccounts(0, [web3.utils.toHex("WL0000001"), web3.utils.toHex(""), web3.utils.toHex("WL0000003")]);

      const waterAccounts = await contract.getWaterAccountsForLicence(0);
      // console.log(waterAccounts);
      assert.equal(waterAccounts.length, 2, "There should be two water accounts");
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
      assert.equal(Number(waterAccounts[1].zoneIndex), 2);
    });

    it("can get all the water accounts for a licence", async function () {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1);
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000003"), 2);
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000004"), 4);

      const waterAccounts = await contract.getWaterAccountsForLicence(0);

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(+waterAccounts[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
    });

    it("can get all the waterAccountIds for a licence", async function () {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1);
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000003"), 2);
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000004"), 4);

      const waterAccounts = await contract.getWaterAccountsForLicence(0);

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(+waterAccounts[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
    });

    it("can get the water accounts from a given waterAccountID", async () => {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1);
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000003"), 2);
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000004"), 4);

      const licenceIndex = await contract.getLicenceIndexForWaterAccountId(web3.utils.toHex("WL0000003"));

      const waterAccounts = await contract.getWaterAccountsForLicence(Number(licenceIndex));

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(+waterAccounts[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
    });

    it("cannot get the water accounts from an invalid waterAccountID", async () => {
      await expectRevert(contract.getWaterAccountsForLicence(0), "There are no water accounts for this licence");
    });

    xit("cannot get the licence from an invalid waterAccountID", async () => {
      await expectRevert(contract.getLicenceIndexForWaterAccountId(web3.utils.toHex("NONEXISTENT")), "There is no matching water account id");
    });
  });
});

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice + "", "gwei");
  return web3.utils.fromWei(gasUsedWeiPrice + "", "ether");
};
