const assertThrows = require('./helpers/TestHelpers').assertThrows;
const Users = artifacts.require("Users");

contract("Users", function(accounts) {

    const User = (values) => { return {userId: values[0], userExists: values[1]} };

    let users;
    let owner = accounts[0];
    let user1Address = accounts[1];
    let user2Address = accounts[2];
    let nonOwner = accounts[3];

    // beforeEach(async () => {
    //     users = await Users.new();
    // });

    xdescribe('Adds users', () => {

        it('Successfully add users', async () => {

            // add a user and assert it was recorded correctly
            await scenarioAddUser({userAddress: user1Address, expectedUserId: 1});

            // add another user and assert for good measure
            await scenarioAddUser({userAddress: user2Address, expectedUserId: 2});

        });

        it('Errors if non-owner attempts to add users', async () => {
            await assertThrows(
                scenarioAddUser({userAddress: user1Address, expectedUserId: 1, fromAddress: nonOwner}),
                'Expected error because non-owner attempted to add user'
            );
        });

    });

    xdescribe('Checks address is registered user', () => {

        it('Successfully checks if an address is a registered user', async () => {

            let precheckIsUser = await users.isUser(user1Address, {from: owner});
            assert.isFalse(precheckIsUser, 'User address should not yet be a register user address');

            // add a user with a specific address
            await scenarioAddUser({userAddress: user1Address, expectedUserId: 1});

            let isUser = await users.isUser(user1Address, {from: owner});
            assert.isTrue(isUser, 'User address should be a register user address');

        });

    });

    async function scenarioAddUser({expectedUserId, userAddress, fromAddress = owner}){
        // let preUser = User(await users.userById(expectedUserId, {from: fromAddress}));
        // assert.isFalse(preUser.userExists, 'Precheck failed - user exists before it is created.')

        // await users.addUser(userAddress, {from: fromAddress});

        // let postUser = User(await users.userById(expectedUserId, {from: fromAddress}));
        // assert.isTrue(postUser.userExists, 'User does not exist after creation.')
    }

});