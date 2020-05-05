pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";
import "./IEIP1753.sol";

contract Licences is Ownable {

    string public name = "Kakadu National Park Camping Permit";
	uint256 public totalSupply;

    mapping(address => bool) private _authorities;

    struct Licence {
        bool licenceExists;
        address ethAccount;
        uint256 validFrom;
		uint256 validTo;
        bytes32[] waterAccountIds;
        mapping(bytes32 => WaterAccount) waterAccounts;
    }

    struct WaterAccount {
        bytes32 waterAccountId;
        uint8 zoneIndex;
        bytes32 zoneString;
    }

    Licence[] public _licences;
    mapping(address => uint256) public _addressToLicenceIndex;
    mapping(bytes32 => uint256) public _waterAccountIdToLicenceIndex;

    constructor() Ownable() public {
        _authorities[msg.sender] = true;
    }

    function grantAuthority(address who) public onlyOwner() {
		_authorities[who] = true;
	}

    function revokeAuthority(address who) public onlyOwner() {
		_authorities[who] = false;
	}

    function hasAuthority(address who) public view returns (bool) {
		return _authorities[who];
	}

    function issue(address who, uint256 start, uint256 end) public onlyAuthority {
		_licences.push(Licence(true, who, start, end, new bytes32[](0)));
        _addressToLicenceIndex[who] = _licences.length - 1;
        emit LicenceAdded(_licences.length - 1, who);
	}

    function issueCompleted(uint256 licenceIndex) public onlyAuthority {
        emit LicenceCompleted(licenceIndex, _licences[licenceIndex].ethAccount);
    }

    function revoke(address who) public onlyAuthority() {
		delete _licences[_addressToLicenceIndex[who]];
	}

    function getLicence(uint256 licenceIndex) public view returns(address, bytes32[]) {
        return (_licences[licenceIndex].ethAccount, _licences[licenceIndex].waterAccountIds);
    }

    function licencesLength() public view returns (uint256) {
        return _licences.length;
    }

    function hasValid(address who) public view returns (bool) {
        Licence storage licence = _licences[_addressToLicenceIndex[who]];
        if (licence.licenceExists) {
            return licence.validFrom > now && licence.validTo < now;
        }
        return false;
	}

    function addLicenceWaterAccount(uint256 licenceIndex, bytes32 waterAccountId, uint8 zoneIndex, bytes32 zoneString)
        public onlyOwner {
        _licences[licenceIndex].waterAccounts[waterAccountId] = WaterAccount(waterAccountId, zoneIndex, zoneString);
        _licences[licenceIndex].waterAccountIds.push(waterAccountId);
        _waterAccountIdToLicenceIndex[waterAccountId] = licenceIndex;
        emit WaterAccountAdded(_licences[licenceIndex].ethAccount);
    }

    function purchase() public payable {
	    revert('Licence purchase is not supported');
	}

    function getWaterAccountIds(uint256 licenceIndex) public view returns (bytes32[]) {
        return _licences[licenceIndex].waterAccountIds;
    }

    function getLicenceIndexForWaterAccountId(bytes32 waterAccountId) public view returns (uint256) {
        require(_licences[_waterAccountIdToLicenceIndex[waterAccountId]].licenceExists, "There is no matching water account id");
        return _waterAccountIdToLicenceIndex[waterAccountId];
    }

    function getWaterAccountForWaterAccountId(bytes32 waterAccountId) public view returns (WaterAccount) {
        return _licences[_waterAccountIdToLicenceIndex[waterAccountId]].waterAccounts[waterAccountId];
    }

    function getWaterAccountsForLicence(uint256 licenceIndex) public view returns (WaterAccount[]) {
        uint256 waterAccountsLength = _licences[licenceIndex].waterAccountIds.length;
        require(waterAccountsLength > 0, "There are no water accounts for this licence");

        WaterAccount[] memory waterAccountArray = new WaterAccount[](waterAccountsLength);

        for(uint i = 0; i < waterAccountsLength; i++) {
            waterAccountArray[i] = _licences[licenceIndex].waterAccounts[_licences[licenceIndex].waterAccountIds[i]];
        }

        return waterAccountArray;
    }

    modifier onlyAuthority() {
		require(hasAuthority(msg.sender), "Only an authority can perform this function");
        _;
	}

    event LicenceAdded(uint256 index, address ethAccount);
    event WaterAccountAdded(address ethAccount);
    event LicenceCompleted(uint256 index, address ethAccount);

}