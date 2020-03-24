const Users = artifacts.require("Users");
const assertThrows = require('./helpers/TestHelpers').assertThrows;

contract.only("Users", function(accounts) {

  let contract;
  let owner = accounts[0];
  let user1Address = accounts[1];
  let user2Address = accounts[2];
  let nonOwner = accounts[3];
  const rawName = 'Sam';
  const name = web3.utils.toHex(rawName);

  beforeEach(async () => contract = await Users.new());

  describe("User", function(){
    it("can add a user", async function() {
        const usersLength = await contract.usersLength();
        await contract.addUser(user2Address, name);
        const usersLengthAfter = await contract.usersLength();
        assert.equal(Number(usersLengthAfter), Number(usersLength) + 1, "User index should be incremented");
    });

    it("can retrieve a user", async function() {
        const usersLength = await contract.usersLength();
        const tx = await contract.addUser(user2Address, name);

        const user = await contract.getUser(usersLength);

        assert.equal(web3.utils.hexToUtf8(user[0]), rawName, 'Name is not saved successfully');
    });

  });

  describe("Licences", function(){

    beforeEach(async () => await contract.addUser(user2Address, name));

    it("can add a licence to a user", async function(){
        await contract.addUserLicence(0, web3.utils.toHex("WL0000002"), 1, web3.utils.toHex("Barron Zone B"));
        const licence = await contract.getLicenceForLicenceId(web3.utils.toHex("WL0000002"));
        assert.equal(web3.utils.hexToUtf8(licence.licenceId), "WL0000002");
    });

    it("can add multiple licences to a user", async function(){
        await contract.addUserLicence(0, web3.utils.toHex("WL0000002"), 1, web3.utils.toHex("Barron Zone B"));
        await contract.addUserLicence(0, web3.utils.toHex("WL0000003"), 2, web3.utils.toHex("Barron Zone C"));
        await contract.addUserLicence(0, web3.utils.toHex("WL0000004"), 4, web3.utils.toHex("Barron Zone E"));

        const licence = await contract.getLicenceForLicenceId(web3.utils.toHex("WL0000004"));

        assert.equal(web3.utils.hexToUtf8(licence.licenceId), "WL0000004");
        assert.equal(web3.utils.hexToUtf8(licence.zoneString), "Barron Zone E");
    });

    it("can get all the licences for a user", async function(){
        await contract.addUserLicence(0, web3.utils.toHex("WL0000002"), 1, web3.utils.toHex("Barron Zone B"));
        await contract.addUserLicence(0, web3.utils.toHex("WL0000003"), 2, web3.utils.toHex("Barron Zone C"));
        await contract.addUserLicence(0, web3.utils.toHex("WL0000004"), 4, web3.utils.toHex("Barron Zone E"));

        const licences = await contract.getLicencesForUser(0);

        assert.equal(licences.length, 3, "Licences array is the wrong length");
        assert.equal(+licences[0].zoneIndex, 1);
        assert.equal(web3.utils.hexToUtf8(licences[1].licenceId), "WL0000003");
        assert.equal(web3.utils.hexToUtf8(licences[2].zoneString), "Barron Zone E");
    });

    it("can get all the licencesIds for a user", async function(){
        await contract.addUserLicence(0, web3.utils.toHex("WL0000002"), 1, web3.utils.toHex("Barron Zone B"));
        await contract.addUserLicence(0, web3.utils.toHex("WL0000003"), 2, web3.utils.toHex("Barron Zone C"));
        await contract.addUserLicence(0, web3.utils.toHex("WL0000004"), 4, web3.utils.toHex("Barron Zone E"));

        const licences = await contract.getLicencesForUser(0);

        // const ids = await contract.getLicenceIds(0);
        // const addresses = await contract.getLicenceAddresses(0);

        assert.equal(licences.length, 3, "Licences array is the wrong length");
        assert.equal(+licences[0].zoneIndex, 1);
        assert.equal(web3.utils.hexToUtf8(licences[1].licenceId), "WL0000003");
        assert.equal(web3.utils.hexToUtf8(licences[2].zoneString), "Barron Zone E");
    });

    it("can get the licences from a given licenceID", async () => {
      await contract.addUserLicence(0, web3.utils.toHex("WL0000002"), 1, web3.utils.toHex("Barron Zone B"));
      await contract.addUserLicence(0, web3.utils.toHex("WL0000003"), 2, web3.utils.toHex("Barron Zone C"));
      await contract.addUserLicence(0, web3.utils.toHex("WL0000004"), 4, web3.utils.toHex("Barron Zone E"));

      const userIndex = await contract.getUserIndexForLicenceId(web3.utils.toHex('WL0000003'));

      const licences = await contract.getLicencesForUser(Number(userIndex));

      assert.equal(licences.length, 3, "Licences array is the wrong length");
      assert.equal(+licences[0].zoneIndex, 1);
      assert.equal(web3.utils.hexToUtf8(licences[1].licenceId), "WL0000003");
      assert.equal(web3.utils.hexToUtf8(licences[2].zoneString), "Barron Zone E");
    });

    it("cannot get the licences from an invalid licenceID", async () => {
      await assertThrows(contract.getLicencesForUser(0), 'There are no licences for this user');
    });

    xit("cannot get the user from an invalid licenceID", async () => {

      await assertThrows(
        contract.getUserIndexForLicenceId(web3.utils.toHex('NONEXISTENT')),
        'There is no matching licence id'
      );

    });


  });
});