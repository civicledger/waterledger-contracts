// const assertThrows = require('./helpers/TestHelpers').assertThrows;
const Users = artifacts.require("Users");

contract("Users", function(accounts) {

    //const User = (values) => { return {userId: values[0], userExists: values[1]} };

    let users;
    let owner = accounts[0];
    let user1Address = accounts[1];
    let user2Address = accounts[2];
    let nonOwner = accounts[3];

    beforeEach(async () => users = await Users.new());



});