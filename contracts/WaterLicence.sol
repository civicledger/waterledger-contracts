pragma solidity ^0.4.24;

import "./Users.sol";
import "./Roles.sol";
import "./TradingZones.sol";
import "./trade-restrictions/TradingPeriodRestriction.sol";
import "./Water.sol";

/// @title Allows water authorities to issue/revoke water licences and manage their entitlements/allocations.
/// @author Civic Ledger
contract WaterLicence {

    struct Licence {
        address licenseeAddress;
        string reference;
        uint256 authorityUserId;
        uint256 tradingZoneId;
        string administrativePlan;
    }

    // Contract dependencies
    Users private _usersContract;
    Roles private _rolesContract;
    TradingZones private _tradingZones;
    TradingPeriodRestriction private _tradingPeriodRestriction;
    Water private _waterTokenContract;

    // Contract Events
    event LicenceIssued(uint256 indexed waterLicenceId, address indexed to, string reference, uint256 tradingZoneId, uint256 startDate, uint256 endDate, string administrativePlan);
    event AllocationAdded(uint256 indexed waterLicenceId, uint256 maxVolume);

    // Licence storage
    Licence[] private _licences;
    mapping(bytes32 => bool) _licenceExists;

    constructor(address usersContractAddress, address rolesContractAddress, address tradingZonesAddress, address waterTokenAddress) public {
        _usersContract = Users(usersContractAddress);
        _rolesContract = Roles(rolesContractAddress);
        _tradingZones = TradingZones(tradingZonesAddress);
        _waterTokenContract = Water(waterTokenAddress);

        _tradingPeriodRestriction = new TradingPeriodRestriction();
    }

    // @dev Ensures that only a water authority can access function
    modifier onlyWaterAuthority() {
        require(_rolesContract.hasRoleByAddress("WaterAuthority", msg.sender), "Only water authorities can issue water licences");
        _;
    }

    /// @dev Retrieves a licence by its index
    /// @param id Id of the licence to retrieve
    /// @return Licence information
    function getLicenceById(uint256 id) public view returns(address, string, uint256, uint256, string, string, uint256, uint256) {
        Licence memory licence = _licences[id];
        (string memory tradingZoneName, ) = _tradingZones.tradingZoneById(licence.tradingZoneId);
        (uint256 startDate, uint256 endDate) = _tradingPeriodRestriction.tradingPeriodByKey(keccak256(abi.encodePacked("WaterLicence", id)), uint256(0));
        return (
            licence.licenseeAddress,
            licence.reference,
            licence.authorityUserId,
            licence.tradingZoneId,
            tradingZoneName,
            licence.administrativePlan,
            startDate,
            endDate
        );
    }

    /// @dev Retrieves the number of licences that have been issued
    /// @return Licence count
    function getLicenceCount() public view returns(uint256) {
        return _licences.length;
    }

    /// @dev Issues a new water licence to a licensee address
    /// @param licenseeAddress The address of the licensee to issue a licence to
    /// @param reference An authority reference for the licence
    /// @param tradingZoneId The trading zone that they are entitled to trade within
    /// @param startDate Licence validity start date - from this date they are able to trade
    /// @param endDate Licence validity end date - after this date they are not able to trade (can be 0 which means no expiry)
    /// @param volume Amount of water to allocate to the licence initially
    function issueLicenceAndAllocate(address licenseeAddress, string reference, uint256 tradingZoneId, uint256 startDate, uint256 endDate, string administrativePlan, uint256 volume) public onlyWaterAuthority {
        uint256 licenceId = _issueLicence(licenseeAddress, reference, tradingZoneId, startDate, endDate, administrativePlan);
        _addAllocation(licenceId, volume);
    }

    /// @dev Issues a new water licence to a licensee address
    /// @param licenseeAddress The address of the licensee to issue a licence to
    /// @param reference An authority reference for the licence
    /// @param tradingZoneId The trading zone that they are entitled to trade within
    /// @param startDate Licence validity start date - from this date they are able to trade
    /// @param endDate Licence validity end date - after this date they are not able to trade (can be 0 which means no expiry)
    function issueLicence(address licenseeAddress, string reference, uint256 tradingZoneId, uint256 startDate, uint256 endDate, string administrativePlan) public onlyWaterAuthority {
        _issueLicence(licenseeAddress, reference, tradingZoneId, startDate, endDate, administrativePlan);
    }

    function _issueLicence(address licenseeAddress, string reference, uint256 tradingZoneId, uint256 startDate, uint256 endDate, string administrativePlan) internal returns(uint256) {
        require(licenseeAddress != address(0), "Must specify an address to issue the licence to");
        require(startDate < endDate || endDate == 0, "Licence start date must be before end date");
        require(_tradingZones.isTradingZone(tradingZoneId), "Trading zone id is not a registered trading zone");

        // get the authorities user id
        (uint256 authorityUserId, bool authorityUserExists) = _usersContract.userByAddress(msg.sender);
        require(authorityUserExists, "Water authority is not a registered user");

        // issue licence
        _licences.push(Licence(licenseeAddress, reference, authorityUserId, tradingZoneId, administrativePlan));

        // licence now exists
        _licenceExists[keccak256(abi.encodePacked(licenseeAddress, reference, tradingZoneId))] = true;

        // set trading period they can trade within
        uint256 licenceId = _licences.length - 1;
        _tradingPeriodRestriction.addTradingPeriod(keccak256(abi.encodePacked("WaterLicence", licenceId)), startDate, endDate);

        emit LicenceIssued(licenceId, licenseeAddress, reference, tradingZoneId, startDate, endDate, administrativePlan);

        return licenceId;
    }

    /// @dev Checks whether a licence has been issued with the passed details
    /// @param licenseeAddress The address of the licensee to check
    /// @param reference The authority reference for the licence
    /// @param tradingZoneId The trading zone of the licence
    /// @return Returns true if the licence exists and false if it doesn't
    function licenceExists(address licenseeAddress, string reference, uint256 tradingZoneId) public view returns(bool) {
        return _licenceExists[keccak256(abi.encodePacked(licenseeAddress, reference, tradingZoneId))];
    }

    /// @dev Adds an allocation to an existing water licence
    /// @param waterLicenceId The index of the licence to add the allocation to
    /// @param volume Sets the volume of water they are allocated to use
    function addAllocation(uint256 waterLicenceId, uint256 volume) onlyWaterAuthority public {
        _addAllocation(waterLicenceId, volume);
    }

    function _addAllocation(uint256 waterLicenceId, uint256 volume) internal {
        // mint water tokens for the water licence holder
        _waterTokenContract.allocate(_licences[waterLicenceId].licenseeAddress, volume);
        emit AllocationAdded(waterLicenceId, volume);
    }

    /// @dev Retrieves an allocation by id
    /// @param waterLicenceId The id of the licence to get the allocation
    /// @return Allocation volume per year
    function allocationById(uint256 waterLicenceId) public view returns(uint256) {
        return _waterTokenContract.balanceOf(_licences[waterLicenceId].licenseeAddress);
    }

    /// @dev Checks whether a licensee can trade
    /// @param waterLicenceId The index of the licence to check trade restrictions for
    /// @param traderAddress The address of the trader looking to trade using the licensee
    /// @param volume The volume of water they want to trade
    /// @return Returns true if they are able to trade, returns false if not able to trade
    function canTrade(uint256 waterLicenceId, address traderAddress, uint256 volume) public view returns(bool) {
        if(waterLicenceId >= _licences.length) {
            return false;
        }
        bytes32 idHash = keccak256(abi.encodePacked("WaterLicence", waterLicenceId));
        return traderAddress == _licences[waterLicenceId].licenseeAddress && _tradingPeriodRestriction.canTrade(idHash, now) &&  _waterTokenContract.balanceOf(_licences[waterLicenceId].licenseeAddress) >= volume;
    }

}