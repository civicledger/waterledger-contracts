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
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1, "Barron Zone B");
      const waterAccount = await contract.getWaterAccountForWaterAccountId(web3.utils.toHex("WL0000002"));
      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), "WL0000002");
    });

    it("can add multiple water accounts to a licence", async function () {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1, "Barron Zone B");
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000003"), 2, "Barron Zone C");
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000004"), 4, "Barron Zone E");

      const waterAccount = await contract.getWaterAccountForWaterAccountId(web3.utils.toHex("WL0000004"));

      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), "WL0000004");
      assert.equal(waterAccount.zoneString, "Barron Zone E");
    });

    it("can get all the water accounts for a licence", async function () {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1, "Barron Zone B");
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000003"), 2, "Barron Zone C");
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000004"), 4, "Barron Zone E");

      const waterAccounts = await contract.getWaterAccountsForLicence(0);

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(+waterAccounts[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
      assert.equal(waterAccounts[2].zoneString, "Barron Zone E");
    });

    it("can get all the waterAccountIds for a licence", async function () {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1, "Barron Zone B");
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000003"), 2, "Barron Zone C");
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000004"), 4, "Barron Zone E");

      const waterAccounts = await contract.getWaterAccountsForLicence(0);

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(+waterAccounts[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
      assert.equal(waterAccounts[2].zoneString, "Barron Zone E");
    });

    it("can get the water accounts from a given waterAccountID", async () => {
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000002"), 1, "Barron Zone B");
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000003"), 2, "Barron Zone C");
      await contract.addLicenceWaterAccount(0, web3.utils.toHex("WL0000004"), 4, "Barron Zone E");

      const licenceIndex = await contract.getLicenceIndexForWaterAccountId(web3.utils.toHex("WL0000003"));

      const waterAccounts = await contract.getWaterAccountsForLicence(Number(licenceIndex));

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(+waterAccounts[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
      assert.equal(waterAccounts[2].zoneString, "Barron Zone E");
    });

    it("cannot get the water accounts from an invalid waterAccountID", async () => {
      await expectRevert(contract.getWaterAccountsForLicence(0), "There are no water accounts for this licence");
    });

    xit("cannot get the licence from an invalid waterAccountID", async () => {
      await expectRevert(contract.getLicenceIndexForWaterAccountId(web3.utils.toHex("NONEXISTENT")), "There is no matching water account id");
    });
  });
});
