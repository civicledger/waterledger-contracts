pragma solidity ^0.4.24;

import "./Ownable.sol";

/// @title Maintains application-wide list of users
/// @author Civic Ledger
contract Users is Ownable {

    struct User {
        uint256 userId;
        bool userExists;
    }

    User[] private _users;
    mapping(address => uint256) private _userAddresses;

    constructor() public {
        _users.push(User(0, false));
    }

    /// @dev Tests whether the address is a registered user address
    /// @param userAddress The address to test whether it is a user address
    /// @return True if address is a registered user, false otherwise
    function isUser(address userAddress) public view returns(bool) {
        uint256 userId = _userAddresses[userAddress];
        return _users[userId].userExists;
    }

    /// @dev Retrieves the user details given its id
    /// @param userId Id of the user to retrieves its details
    /// @return User details
    function userById(uint256 userId) public view returns(uint256, bool) {
        User memory user = (userId >= _users.length) ? _users[0] : _users[userId];
        return (
            user.userId,
            user.userExists
        );
    }

    /// @dev Returns the number of users for enumeration
    /// @return Count of users
    function userCount() public view returns(uint256) {
        return _users.length;
    }

    /// @dev Retrieves the user details given its id
    /// @param userAddress Address of the user to retrieves its details
    /// @return User details
    function userByAddress(address userAddress) public view returns(uint256, bool) {
        uint256 userId = _userAddresses[userAddress];
        return (
            _users[userId].userId,
            _users[userId].userExists
        );
    }

    /// @dev Adds a new registered user
    /// @param userAddress The address of the user
    function addUser(address userAddress) public onlyOwner {
        uint256 userId = _users.length;
        _users.push(User(userId, true));
        _userAddresses[userAddress] = userId;
    }

}