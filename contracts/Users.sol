pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";

contract Users is Ownable {

    struct User {
        bool userExists;
        bytes32 name;
        address[] licenceAddresses;
        mapping(address => Licence) licences;
    }

    struct Licence {
        bytes32 licenceId;
        address ethAccount;
        uint8 zoneIndex;
        bytes32 zoneString;
    }

    User[] public _users;
    mapping(address => uint256) public _licenceAddressToUser;
    mapping(bytes32 => address) public _licenceIdToAddress;

    function addUser(bytes32 name) public onlyOwner returns (uint256) {
        _users.push(User(true, name, new address[](0)));
        return _users.length - 1;
    }

    function addUserLicence(uint256 userIndex, bytes32 licenceId, address ethAccount, uint8 zoneIndex, bytes32 zoneString)
        public onlyOwner returns (Licence) {
        _users[userIndex].licences[ethAccount] = Licence(licenceId, ethAccount, zoneIndex, zoneString);
        _users[userIndex].licenceAddresses.push(ethAccount);
        _licenceAddressToUser[ethAccount] = userIndex;
        _licenceIdToAddress[licenceId] = ethAccount;
        return _users[userIndex].licences[ethAccount];
    }

    function getUserIndexForLicenceId(bytes32 licenceId) public view returns (uint256) {
        address ethAccount = _licenceIdToAddress[licenceId];
        return _licenceAddressToUser[ethAccount];
    }


    function getLicenceForLicenceId(bytes32 licenceId) public view returns (Licence) {
        address ethAccount = _licenceIdToAddress[licenceId];
        return _users[_licenceAddressToUser[ethAccount]].licences[ethAccount];
    }

    function getLicencesForUser(uint256 userIndex) public view returns (Licence[]) {
        uint256 licenceLength = _users[userIndex].licenceAddresses.length;
        require(licenceLength > 0, "There are no licences for this user");

        Licence[] memory licenceArray = new Licence[](licenceLength);

        for(uint i = 0; i <= licenceLength; i++) {
            licenceArray[i] = _users[userIndex].licences[_users[userIndex].licenceAddresses[i]];
        }

        return licenceArray;
    }

}