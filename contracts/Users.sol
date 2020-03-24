pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";

contract Users is Ownable {

    struct User {
        bool userExists;
        address ethAccount;
        bytes32 name;
        bytes32[] licenceIds;
        mapping(bytes32 => Licence) licences;
    }

    struct Licence {
        bytes32 licenceId;
        uint8 zoneIndex;
        bytes32 zoneString;
    }

    User[] public _users;
    mapping(address => uint256) public _addressToUserIndex;
    mapping(bytes32 => uint256) public _licenceIdToUserIndex;

    function addUser(address ethAccount, bytes32 name) public onlyOwner returns (uint256) {
        _users.push(User(true, ethAccount, name, new bytes32[](0)));
        _addressToUserIndex[ethAccount] = _users.length - 1;
        emit UserAdded(_users.length - 1, ethAccount, name);
        return _users.length - 1;
    }

    function getUser(uint256 userIndex) public view returns(bytes32, address, bytes32[]) {
        return (_users[userIndex].name, _users[userIndex].ethAccount, _users[userIndex].licenceIds);
    }

    function usersLength() public view returns (uint256) {
        return _users.length;
    }

    function addUserLicence(uint256 userIndex, bytes32 licenceId, uint8 zoneIndex, bytes32 zoneString)
        public onlyOwner {
        _users[userIndex].licences[licenceId] = Licence(licenceId, zoneIndex, zoneString);
        _users[userIndex].licenceIds.push(licenceId);
        _licenceIdToUserIndex[licenceId] = userIndex;
    }

    function getLicenceIds(uint256 userIndex) public view returns (bytes32[]) {
        return _users[userIndex].licenceIds;
    }

    function getUserIndexForLicenceId(bytes32 licenceId) public view returns (uint256) {
        require(_users[_licenceIdToUserIndex[licenceId]].userExists, "There is no matching licence id");
        return _licenceIdToUserIndex[licenceId];
    }

    function getLicenceForLicenceId(bytes32 licenceId) public view returns (Licence) {
        return _users[_licenceIdToUserIndex[licenceId]].licences[licenceId];
    }

    function getLicencesForUser(uint256 userIndex) public view returns (Licence[]) {
        uint256 licenceLength = _users[userIndex].licenceIds.length;
        require(licenceLength > 0, "There are no licences for this user");

        Licence[] memory licenceArray = new Licence[](licenceLength);

        for(uint i = 0; i < licenceLength; i++) {
            licenceArray[i] = _users[userIndex].licences[_users[userIndex].licenceIds[i]];
        }

        return licenceArray;
    }

    event UserAdded(uint256 index, address ethAccount, bytes32 name);

}