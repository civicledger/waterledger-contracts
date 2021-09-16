const Licences = artifacts.require("Licences");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { addYears, startOfYear, getUnixTime } = require("date-fns");

contract.only("Licences", function (accounts) {
  let contract;
  let owner = accounts[0];
  let user1Address = accounts[1];
  let user2Address = accounts[2];
  let nonOwner = accounts[3];
  const toHex = web3.utils.toHex;

  const defaultLicenceString = "WL-000001234";
  const defaultLicenceHex = toHex(defaultLicenceString);

  const defaultAccountString = "WA-0001";
  const defaultAccountHex = toHex(defaultAccountString);

  const fromDate = getUnixTime(startOfYear(new Date()));
  const toDate = getUnixTime(addYears(new Date(), 1));

  beforeEach(async () => (contract = await Licences.new()));

  describe("Licences", function () {
    it("can add and retrieve a licence", async function () {
      await contract.issue(user2Address, defaultLicenceHex, fromDate, toDate);
      const licence = await contract.getLicence(defaultLicenceHex);
      assert.equal(licence[0], user2Address, "Address is not saved successfully");
    });

    it("can check a licence", async function () {
      await contract.issue(user2Address, defaultLicenceHex, fromDate, toDate);
      const hasValidLicence = await contract.hasValid(user2Address);

      assert.ok(hasValidLicence, "Address not returning as valid licence");
    });
  });

  describe("water accounts", function () {
    beforeEach(async () => await contract.issue(user2Address, defaultLicenceHex, fromDate, toDate));

    it("can add a water account to a licence", async function () {
      await contract.addLicenceWaterAccount(defaultLicenceHex, defaultAccountHex, 1);
      const waterAccount = await contract.getWaterAccountForWaterAccountId(defaultAccountHex);
      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), defaultAccountString);
    });

    it("can add multiple water accounts to a licence", async function () {
      const testAccount = "WA-0003";
      await contract.addLicenceWaterAccount(defaultLicenceHex, toHex("WA-0000"), 0);
      await contract.addLicenceWaterAccount(defaultLicenceHex, toHex("WA-0001"), 1);
      await contract.addLicenceWaterAccount(defaultLicenceHex, toHex(testAccount), 3);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(toHex(testAccount));

      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), testAccount);
    });

    it("can add multiple water accounts to a licence in one step", async function () {
      await contract.addAllLicenceWaterAccounts(defaultLicenceHex, [web3.utils.toHex("WL0000002"), web3.utils.toHex("WL0000003")]);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(web3.utils.toHex("WL0000003"));

      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), "WL0000003");
    });

    it("can add multiple water accounts to a licence in one step with sparse arrays", async function () {
      await contract.addAllLicenceWaterAccounts(defaultLicenceHex, [
        web3.utils.toHex("WL0000001"),
        web3.utils.toHex(""),
        web3.utils.toHex("WL0000003"),
      ]);

      const waterAccounts = await contract.getWaterAccountsForLicence(defaultLicenceHex);

      assert.equal(waterAccounts.length, 2, "There should be two water accounts");
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
      assert.equal(Number(waterAccounts[1].zoneIndex), 2);
    });

    it("can add multiple water accounts using real-world data", async function () {
      const accounts = [
        "0x46412d3132323000000000000000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ];
      await contract.addAllLicenceWaterAccounts(defaultLicenceHex, accounts);
    });

    it("can add multiple water accounts to a licence in one step", async function () {
      await contract.addAllLicenceWaterAccounts(defaultLicenceHex, [web3.utils.toHex("WL0000002"), web3.utils.toHex("WL0000003")]);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(web3.utils.toHex("WL0000003"));

      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), "WL0000003");
    });

    it("can get all the waterAccountIds for a licence", async function () {
      await contract.addLicenceWaterAccount(defaultLicenceHex, web3.utils.toHex("WL0000002"), 1);
      await contract.addLicenceWaterAccount(defaultLicenceHex, web3.utils.toHex("WL0000003"), 2);
      await contract.addLicenceWaterAccount(defaultLicenceHex, web3.utils.toHex("WL0000004"), 4);

      const waterAccounts = await contract.getWaterAccountsForLicence(defaultLicenceHex);

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(+waterAccounts[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
    });

    it("can get the water accounts from a given waterAccountID", async () => {
      await contract.addLicenceWaterAccount(defaultLicenceHex, web3.utils.toHex("WL0000002"), 1);
      await contract.addLicenceWaterAccount(defaultLicenceHex, web3.utils.toHex("WL0000003"), 2);
      await contract.addLicenceWaterAccount(defaultLicenceHex, web3.utils.toHex("WL0000004"), 4);

      const identifier = await contract.getIdentifierForWaterAccountId(web3.utils.toHex("WL0000003"));
      const waterAccounts = await contract.getWaterAccountsForLicence(identifier);

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(+waterAccounts[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(waterAccounts[1].waterAccountId), "WL0000003");
    });

    it("cannot get the water accounts from an invalid waterAccountID", async () => {
      await expectRevert(contract.getWaterAccountsForLicence(defaultLicenceHex), "There are no water accounts for this licence");
    });

    it("cannot get the licence from an invalid waterAccountID", async () => {
      await expectRevert(contract.getIdentifierForWaterAccountId(web3.utils.toHex("NONEXISTENT")), "There is no matching water account id");
    });
  });

  describe("can issue enhanced licence", async () => {
    it("can issue a licence", async () => {
      await contract.issue(user1Address, web3.utils.toHex("WL0000001"), fromDate, toDate);

      const licence = await contract.getLicence(web3.utils.toHex("WL0000001"));

      const [ethAccount, identifier] = Object.values(licence);

      assert.equal(ethAccount, user1Address, "Incorrect eth account on licence");
      assert.equal(web3.utils.hexToUtf8(identifier), "WL0000001", "Incorrect identifier on licence");
    });

    it("can add water accounts even without an existing licence", async () => {
      await contract.addLicenceWaterAccount(defaultLicenceHex, web3.utils.toHex("WA-0001"), 0);

      const [ethAccount, identifier, waterAccounts] = Object.values(await contract.getLicence(defaultLicenceHex));

      assert.equal(ethAccount, 0, "Incorrect eth account on licence");
      assert.equal(web3.utils.hexToUtf8(identifier), "", "Incorrect identifier on licence");
      assert.equal(waterAccounts.length, 1, "Incorrect number of water accounts on licence");
    });
  });
});

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice + "", "gwei");
  return web3.utils.fromWei(gasUsedWeiPrice + "", "ether");
};
