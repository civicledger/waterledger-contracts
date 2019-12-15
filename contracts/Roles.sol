pragma solidity ^0.4.24;

import "./Ownable.sol";
import "./Users.sol";

/// @title Maintains application-wide role assignments 
/// @author Civic Ledger
contract Roles is Ownable {

    Users _usersContract;
    mapping(uint256 => string[]) _rolesNamesAssigned;

    constructor(address userContractAddress) public {
        _usersContract = Users(userContractAddress);
    }

    /// @dev Assigns a role to an address
    /// @param roleName The name of the role, constrained to 32 bytes
    /// @param assigneeUser The user id of the role assignee
    function assignRole(string roleName, uint256 assigneeUser) public onlyOwner {
        (uint256 userId, bool userExists) = _usersContract.userById(assigneeUser);
        require(userId > 0 && userExists == true, "Assignee user is not a registered user");
        _rolesNamesAssigned[assigneeUser].push(roleName);
    }

    /// @dev Revokes a role from an address
    /// @param roleName The name of the role, constrained to 32 bytes
    /// @param assigneeUser The user id of the role assignee to revoke
    function revokeRole(string roleName, uint256 assigneeUser) public onlyOwner {
        string[] memory userRoles = _rolesNamesAssigned[assigneeUser];
        for (uint i = 0; i < userRoles.length; i++){
            if(keccak256(bytes(userRoles[i])) == keccak256(bytes(roleName))) {
                userRoles[i] = userRoles[_rolesNamesAssigned[assigneeUser].length-1];
                _rolesNamesAssigned[assigneeUser].length--;
            }
        }
    }

    /// @dev Checks a user has a particular role
    /// @param roleName The name of the role, constrained to 32 bytes
    /// @param assigneeUser The user id of the role assignee
    /// @return bool - true if they have the role, false if they do not have the role
    function hasRoleById(string roleName, uint256 assigneeUser) public view returns(bool) {
        for (uint i = 0; i < _rolesNamesAssigned[assigneeUser].length; i++) {
            if(keccak256(bytes(_rolesNamesAssigned[assigneeUser][i])) == keccak256(bytes(roleName))) {
                return true;
            }
        }
        return false;
    }

    /// @dev Checks an address has a particular role
    /// @param roleName The name of the role, constrained to 32 bytes
    /// @param assigneeUserAddress The user address of the role assignee
    /// @return bool - true if they have the role, false if they do not have the role
    function hasRoleByAddress(string roleName, address assigneeUserAddress) public view returns(bool) {
        (uint256 userId, bool userExists) = _usersContract.userByAddress(assigneeUserAddress);
        if(userExists) {
            return hasRoleById(roleName, userId);
        }
        return false;
    }
}