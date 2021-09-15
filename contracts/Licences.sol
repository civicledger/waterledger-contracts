pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
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
    }

    Licence[] public _licences;
    mapping(address => uint256) public _addressToLicenceIndex;
    mapping(bytes32 => uint256) public _waterAccountIdToLicenceIndex;
    mapping(address => mapping(uint8 => bytes32)) public _addressToZoneIndexToWaterAccountId;

    constructor() public Ownable() {
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

    function issue(
        address who,
        uint256 start,
        uint256 end
    ) public onlyAuthority {
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

    function getLicence(uint256 licenceIndex) public view returns (address, bytes32[] memory) {
        return (_licences[licenceIndex].ethAccount, _licences[licenceIndex].waterAccountIds);
    }

    function licencesLength() public view returns (uint256) {
        return _licences.length;
    }

    function hasValid(address who) public view returns (bool) {
        return _licences[_addressToLicenceIndex[who]].licenceExists;
    }

    function addLicenceWaterAccount(
        uint256 licenceIndex,
        bytes32 waterAccountId,
        uint8 zoneIndex
    ) public onlyAuthority {
        _licences[licenceIndex].waterAccounts[waterAccountId] = WaterAccount(waterAccountId, zoneIndex);
        _licences[licenceIndex].waterAccountIds.push(waterAccountId);
        _waterAccountIdToLicenceIndex[waterAccountId] = licenceIndex;
        _addressToZoneIndexToWaterAccountId[_licences[licenceIndex].ethAccount][zoneIndex] = waterAccountId;
        emit WaterAccountAdded(_licences[licenceIndex].ethAccount);
    }

    function addAllLicenceWaterAccounts(
        uint256 licenceIndex,
        bytes32[] memory waterAccountIds
    ) public onlyAuthority {
        for (uint8 i = 0; i < waterAccountIds.length; i++) {
            if(waterAccountIds[i] != "") {
                _licences[licenceIndex].waterAccounts[waterAccountIds[i]] = WaterAccount(waterAccountIds[i], i);
                _licences[licenceIndex].waterAccountIds.push(waterAccountIds[i]);
                _waterAccountIdToLicenceIndex[waterAccountIds[i]] = licenceIndex;
                _addressToZoneIndexToWaterAccountId[_licences[licenceIndex].ethAccount][i] = waterAccountIds[i];
                emit WaterAccountAdded(_licences[licenceIndex].ethAccount);
            }
        }
        emit LicenceCompleted(licenceIndex, _licences[licenceIndex].ethAccount);
    }

    function purchase() public payable {
        revert("Licence purchase is not supported");
    }

    function getWaterAccountIds(uint256 licenceIndex) public view returns (bytes32[] memory) {
        return _licences[licenceIndex].waterAccountIds;
    }

    function getLicenceIndexForWaterAccountId(bytes32 waterAccountId) public view returns (uint256) {
        require(_licences[_waterAccountIdToLicenceIndex[waterAccountId]].licenceExists, "There is no matching water account id");
        return _waterAccountIdToLicenceIndex[waterAccountId];
    }

    function getWaterAccountForWaterAccountId(bytes32 waterAccountId) public view returns (WaterAccount memory) {
        return _licences[_waterAccountIdToLicenceIndex[waterAccountId]].waterAccounts[waterAccountId];
    }

    function getWaterAccountsForLicence(uint256 licenceIndex) public view returns (WaterAccount[] memory) {
        uint256 waterAccountsLength = _licences[licenceIndex].waterAccountIds.length;
        require(waterAccountsLength > 0, "There are no water accounts for this licence");

        WaterAccount[] memory waterAccountArray = new WaterAccount[](waterAccountsLength);

        for (uint256 i = 0; i < waterAccountsLength; i++) {
            waterAccountArray[i] = _licences[licenceIndex].waterAccounts[_licences[licenceIndex].waterAccountIds[i]];
        }

        return waterAccountArray;
    }

    function getWaterAccountIdByAddressAndZone(address ethAccount, uint8 zoneIndex) public view returns (bytes32) {
        return _addressToZoneIndexToWaterAccountId[ethAccount][zoneIndex];
    }

    modifier onlyAuthority() {
        require(hasAuthority(msg.sender), "Only an authority can perform this function");
        _;
    }

    event LicenceAdded(uint256 index, address ethAccount);
    event WaterAccountAdded(address ethAccount);
    event LicenceCompleted(uint256 index, address ethAccount);
}
