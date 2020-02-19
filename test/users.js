// const assertThrows = require('./helpers/TestHelpers').assertThrows;
const Users = artifacts.require("Users");

contract("Users", function(accounts) {

  //const User = (values) => { return {userId: values[0], userExists: values[1]} };

  let contract;
  let owner = accounts[0];
  let user1Address = accounts[1];
  let user2Address = accounts[2];
  let nonOwner = accounts[3];
  const name = web3.utils.toHex('Sam');

  beforeEach(async () => contract = await Users.new());

  describe("User", function(){
    it("can add a user", async function() {
        const user = await contract.addUser(name)
        console.log(user);
    });

  });

  describe("Licences", function(){

  });
});