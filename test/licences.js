const Licences = artifacts.require("Licences");
const OrderBook = artifacts.require("OrderBook");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { addYears, startOfYear, getUnixTime } = require("date-fns");

const toHex = web3.utils.toHex;
const fromHex = web3.utils.hexToUtf8;

contract("Licences", function (accounts) {
  let contract;
  let orderbookContract;
  let user1Address = accounts[1];
  let user2Address = accounts[2];

  const defaultLicenceString = "WL-000001234";
  const defaultLicenceHex = toHex(defaultLicenceString);

  const defaultAccountString = "WA-0001";
  const defaultAccountHex = toHex(defaultAccountString);

  const fromDate = getUnixTime(startOfYear(new Date()));
  const toDate = getUnixTime(addYears(new Date(), 1));

  const demoaString = "barron-a";
  const demobString = "barron-a";
  const democString = "barron-a";
  const demodString = "barron-a";

  const demoaHex = toHex(demoaString);
  const demobHex = toHex(demobString);
  const democHex = toHex(democString);
  const demodHex = toHex(demodString);

  beforeEach(async () => {
    orderbookContract = await OrderBook.new("Test Level 1 Resource", 2001);
    contract = await Licences.new(orderbookContract.address);
  });

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
      await contract.addLicenceWaterAccount(defaultLicenceHex, defaultAccountHex, demobHex);
      const waterAccount = await contract.getWaterAccountForWaterAccountId(defaultAccountHex);
      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), defaultAccountString);
    });

    it("can add multiple water accounts to a licence", async function () {
      const testAccount = "WA-0003";
      await contract.addLicenceWaterAccount(defaultLicenceHex, toHex("WA-0000"), demoaHex);
      await contract.addLicenceWaterAccount(defaultLicenceHex, toHex("WA-0001"), demobHex);
      await contract.addLicenceWaterAccount(defaultLicenceHex, toHex(testAccount), demodHex);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(toHex(testAccount));

      assert.equal(fromHex(waterAccount.waterAccountId), testAccount);
    });

    it("can add multiple water accounts to a licence in one step", async function () {
      await contract.addAllLicenceWaterAccounts(defaultLicenceHex, [toHex("WL0000002"), toHex("WL0000003")], [demobHex, democHex]);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(toHex("WL0000003"));

      const waterAccountIdFromMapping = await contract.getWaterAccountIdByAddressAndZone(user2Address, demobHex);

      assert.equal(fromHex(waterAccount.waterAccountId), "WL0000003");
      assert.equal(fromHex(waterAccountIdFromMapping), "WL0000003");
    });

    it("can get all the waterAccountIds for a licence", async function () {
      await contract.addAllLicenceWaterAccounts(
        defaultLicenceHex,
        [toHex("WL0000002"), toHex("WL0000003"), toHex("WL0000004")],
        [demobHex, democHex, demodHex]
      );

      const waterAccounts = await contract.getWaterAccountsForLicence(defaultLicenceHex);

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(fromHex(waterAccounts[1].waterAccountId), "WL0000003");
    });

    it("cannot add multiple accounts with different array lengths", async () => {
      await expectRevert(
        contract.addAllLicenceWaterAccounts(defaultLicenceHex, [toHex("WL0000002"), toHex("WL0000003")], [demobHex]),
        "Input arrays must be the same length"
      );
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
      await contract.issue(user1Address, toHex("WL0000001"), fromDate, toDate);

      const licence = await contract.getLicence(toHex("WL0000001"));

      const [ethAccount, identifier] = Object.values(licence);

      assert.equal(ethAccount, user1Address, "Incorrect eth account on licence");
      assert.equal(fromHex(identifier), "WL0000001", "Incorrect identifier on licence");
    });

    it("can add water accounts even without an existing licence", async () => {
      await contract.addLicenceWaterAccount(defaultLicenceHex, toHex("WA-0001"), demoaHex);

      const [ethAccount, identifier, waterAccounts] = Object.values(await contract.getLicence(defaultLicenceHex));

      assert.equal(ethAccount, 0, "Incorrect eth account on licence");
      assert.equal(fromHex(identifier), "", "Incorrect identifier on licence");
      assert.equal(waterAccounts.length, 1, "Incorrect number of water accounts on licence");
    });
  });
});

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice + "", "gwei");
  return web3.utils.fromWei(gasUsedWeiPrice + "", "ether");
};
