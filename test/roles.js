const assertThrows = require('./helpers/TestHelpers').assertThrows;
const Users = artifacts.require("Users");
const Roles = artifacts.require("Roles");

contract("Roles", function(accounts) {

    let users;
    let role;
    const owner = accounts[0];
    const assigneeAddress = accounts[1];
    const nonOwner = accounts[2];
    const random = accounts[3];
    const assignee = 1;
    const notRegisteredUser = 2;
    const roleName = 'WaterAuthority';

    beforeEach(async () => {
        users = await Users.new();
        // add test user
        await users.addUser(assigneeAddress, {from: owner});
        role = await Roles.new(users.address);
    });

    describe('Assigns roles', () => {

        it('Successfully assigns a role to a user', async () => {

            await role.assignRole(roleName, assignee, {from: owner});

            let hasRole = await role.hasRoleById(roleName, assignee);
            assert.isTrue(hasRole, 'Role should be assigned to user');

        });

        it('Errors if non-owner attempts to assign role', async () => {

            await assertThrows(
                role.assignRole(roleName, assignee, {from: nonOwner}),
                'Expected to error if non-owner attempts to assign'
            );

        });

        it('Errors given assignee that is not a registered user', async () => {

            await assertThrows(
                role.assignRole(roleName, notRegisteredUser, {from: nonOwner}),
                'Expected to error given non registered user'
            );

        });

    });

    describe('Revokes roles', () => {

        it('Successfully revokes a role from a user', async () => {

            // assign a role
            await role.assignRole(roleName, assignee, {from: owner});
            // precheck role is actually assigned
            let hasRole = await role.hasRoleById(roleName, assignee);
            assert.isTrue(hasRole, 'Precheck failed - role not assigned to user');

            await role.revokeRole(roleName, assignee, {from: owner});
            hasRole = await role.hasRoleById(roleName, assignee);
            assert.isFalse(hasRole, 'Role should have been revoked from user');

        });

        it('Errors if non-owner attempts to revoke role', async () => {

            // assign a role
            await role.assignRole(roleName, assignee, {from: owner});
            // precheck role is actually assigned
            let hasRole = await role.hasRoleById(roleName, assignee);
            assert.isTrue(hasRole, 'Precheck failed - role not assigned to user');

            await assertThrows(
                role.assignRole(roleName, assignee, {from: nonOwner}),
                'Expected to error if non-owner attempts to revoke'
            );

        });

    });

    describe('Checks role by user address', () => {

        it('Sucessfully checks role by user address', async () => {
            let preHasRole = await role.hasRoleByAddress(roleName, assigneeAddress);
            assert.isFalse(preHasRole, 'Role should not be assigned to user yet');

            await role.assignRole(roleName, assignee, {from: owner});

            let hasRole = await role.hasRoleByAddress(roleName, assigneeAddress);
            assert.isTrue(hasRole, 'Role should be assigned to user');
        });

        it('Returns false if the user does not exist', async () => {
            let hasRole = await role.hasRoleByAddress(roleName, random);
            assert.isFalse(hasRole, 'Should return false if the user does not exist');
        });

    });

});