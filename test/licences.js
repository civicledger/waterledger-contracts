const ExtractionRights = artifacts.require("ExtractionRights");
const OrderBook = artifacts.require("OrderBook");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { addYears, startOfYear, getUnixTime } = require("date-fns");

const toHex = web3.utils.toHex;
const fromHex = web3.utils.hexToUtf8;

contract("ExtractionRights", function (accounts) {
  let contract;
  let orderbookContract;
  let user1Address = accounts[1];
  let user2Address = accounts[2];

  const defaultExtractionRightString = "WL-000001234";
  const defaultExtractionRightHex = toHex(defaultExtractionRightString);

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
    contract = await ExtractionRights.new(orderbookContract.address);
  });

  describe("ExtractionRights", function () {
    it("can add and retrieve an extraction right", async function () {
      await contract.issue(user2Address, defaultExtractionRightHex, fromDate, toDate);
      const extractionRight = await contract.getExtractionRight(defaultExtractionRightHex);
      assert.equal(extractionRight[0], user2Address, "Address is not saved successfully");
    });

    it("can check an extraction right", async function () {
      await contract.issue(user2Address, defaultExtractionRightHex, fromDate, toDate);
      const hasValidExtractionRight = await contract.hasValid(user2Address);

      assert.ok(hasValidExtractionRight, "Address not returning as valid extraction right");
    });
  });

  describe("water accounts", function () {
    beforeEach(async () => await contract.issue(user2Address, defaultExtractionRightHex, fromDate, toDate));

    it("can add a water account to an extraction right", async function () {
      await contract.addExtractionRightWaterAccount(defaultExtractionRightHex, defaultAccountHex, demobHex);
      const waterAccount = await contract.getWaterAccountForWaterAccountId(defaultAccountHex);
      assert.equal(web3.utils.hexToUtf8(waterAccount.waterAccountId), defaultAccountString);
    });

    it("can add multiple water accounts to an extraction right", async function () {
      const testAccount = "WA-0003";
      await contract.addExtractionRightWaterAccount(defaultExtractionRightHex, toHex("WA-0000"), demoaHex);
      await contract.addExtractionRightWaterAccount(defaultExtractionRightHex, toHex("WA-0001"), demobHex);
      await contract.addExtractionRightWaterAccount(defaultExtractionRightHex, toHex(testAccount), demodHex);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(toHex(testAccount));

      assert.equal(fromHex(waterAccount.waterAccountId), testAccount);
    });

    it("can add multiple water accounts to an extraction right in one step", async function () {
      await contract.addAllExtractionRightWaterAccounts(defaultExtractionRightHex, [toHex("WL0000002"), toHex("WL0000003")], [demobHex, democHex]);

      const waterAccount = await contract.getWaterAccountForWaterAccountId(toHex("WL0000003"));

      const waterAccountIdFromMapping = await contract.getWaterAccountIdByAddressAndLevel0Resource(user2Address, demobHex);

      assert.equal(fromHex(waterAccount.waterAccountId), "WL0000003");
      assert.equal(fromHex(waterAccountIdFromMapping), "WL0000003");
    });

    it("can get all the waterAccountIds for an extraction right", async function () {
      await contract.addAllExtractionRightWaterAccounts(
        defaultExtractionRightHex,
        [toHex("WL0000002"), toHex("WL0000003"), toHex("WL0000004")],
        [demobHex, democHex, demodHex]
      );

      const waterAccounts = await contract.getWaterAccountsForExtractionRight(defaultExtractionRightHex);

      assert.equal(waterAccounts.length, 3, "Water Accounts array is the wrong length");
      assert.equal(fromHex(waterAccounts[1].waterAccountId), "WL0000003");
    });

    it("cannot add multiple accounts with different array lengths", async () => {
      await expectRevert(
        contract.addAllExtractionRightWaterAccounts(defaultExtractionRightHex, [toHex("WL0000002"), toHex("WL0000003")], [demobHex]),
        "Input arrays must be the same length"
      );
    });

    it("cannot get the water accounts from an invalid waterAccountID", async () => {
      await expectRevert(
        contract.getWaterAccountsForExtractionRight(defaultExtractionRightHex),
        "There are no water accounts for this extraction right"
      );
    });

    it("cannot get the extraction right from an invalid waterAccountID", async () => {
      await expectRevert(contract.getIdentifierForWaterAccountId(web3.utils.toHex("NONEXISTENT")), "There is no matching water account id");
    });
  });

  describe("can issue enhanced extraction right", async () => {
    it("can issue an extraction right", async () => {
      await contract.issue(user1Address, toHex("WL0000001"), fromDate, toDate);

      const extractionRight = await contract.getExtractionRight(toHex("WL0000001"));

      const [ethAccount, identifier] = Object.values(extractionRight);

      assert.equal(ethAccount, user1Address, "Incorrect eth account on extraction right");
      assert.equal(fromHex(identifier), "WL0000001", "Incorrect identifier on extraction right");
    });

    it("can add water accounts even without an existing extraction right", async () => {
      await contract.addExtractionRightWaterAccount(defaultExtractionRightHex, toHex("WA-0001"), demoaHex);

      const [ethAccount, identifier, waterAccounts] = Object.values(await contract.getExtractionRight(defaultExtractionRightHex));

      assert.equal(ethAccount, 0, "Incorrect eth account on extraction right");
      assert.equal(fromHex(identifier), "", "Incorrect identifier on extraction right");
      assert.equal(waterAccounts.length, 1, "Incorrect number of water accounts on extraction right");
    });
  });
});

const getGasCostInEth = tx => {
  const gasUsedGweiPrice = tx.receipt.gasUsed * 5;
  const gasUsedWeiPrice = web3.utils.toWei(gasUsedGweiPrice + "", "gwei");
  return web3.utils.fromWei(gasUsedWeiPrice + "", "ether");
};
