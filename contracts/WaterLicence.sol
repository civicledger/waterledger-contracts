pragma solidity ^0.4.24;

import "./Users.sol";
import "./Roles.sol";

/// @title Allows water authorities to issue/revoke water licences and manage their entitlements/allocations.
/// @author Civic Ledger
contract WaterLicence {

    struct Licence {
        address licenseeAddress;
        string reference;
        uint256 authorityUserId;
        string administrativePlan;
    }

    // Contract dependencies
    Users private _usersContract;
    Roles private _rolesContract;

    // Contract Events
    event LicenceIssued(uint256 indexed waterLicenceId, address indexed to, string reference, uint256 tradingZoneId, uint256 startDate, uint256 endDate, string administrativePlan);
    event AllocationAdded(uint256 indexed waterLicenceId, uint256 maxVolume);

    // Licence storage
    Licence[] private _licences;
    mapping(bytes32 => bool) _licenceExists;

    constructor(address usersContractAddress, address rolesContractAddress) public {
        _usersContract = Users(usersContractAddress);
        _rolesContract = Roles(rolesContractAddress);
    }

    // @dev Ensures that only a water authority can access function
    modifier onlyWaterAuthority() {
        require(_rolesContract.hasRoleByAddress("WaterAuthority", msg.sender), "Only water authorities can issue water licences");
        _;
    }


}