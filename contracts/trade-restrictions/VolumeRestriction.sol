pragma solidity ^0.4.24;

import "../SafeMath.sol";
import "../utils/BokkyPooBahsDateTimeLibrary.sol";
import "./TradeRestriction.sol";

/// @title Restricts trading by a set volume per period (daily, monthly, yearly)
/// @author Civic Ledger
contract VolumeRestriction is TradeRestriction {

    using SafeMath for uint256;

    enum VolumePeriodType {
        PerDay,
        PerMonth,
        PerYear
    }   

    struct VolumePeriod {
        uint256 volume;
        VolumePeriodType periodType;
        // only applicable to PerYear period
        uint8 yearStartMonth;
        uint8 yearEndMonth;
    }

    mapping(bytes32 => VolumePeriod) public _maxVolumes;
    mapping(bytes32 => uint256) public _currentVolumes;

    /// @dev Adds a volume restriction (with default calendar year)
    /// @param keyHash Key hash of the thing to be restricted
    /// @param maxVolume maxVolume Maximum trade volume per period
    /// @param periodType Period type id - PerDay, PerMonth, PerYear
    function addMaxVolume(bytes32 keyHash, uint256 maxVolume, VolumePeriodType periodType) public onlyParentContract() {
        addMaxVolumeWithCustomYear(keyHash, maxVolume, periodType, 1, 12); // defaults to calendar year
    }

    /// @dev Adds a volume restriction (with custom calendar, i.e financial year)
    /// @param keyHash Key hash of the restricted thing, to retrieve restriction details
    /// @param maxVolume Maximum trade volume per period
    /// @param periodType Period type id - PerDay, PerMonth, PerYear
    /// @param yearStartMonth Year calendar start month (1 === Jan)
    /// @param yearEndMonth Year calendar end month
    function addMaxVolumeWithCustomYear(bytes32 keyHash, uint256 maxVolume, VolumePeriodType periodType, uint8 yearStartMonth, uint8 yearEndMonth) public onlyParentContract() {
        _maxVolumes[keyHash] = VolumePeriod(maxVolume, periodType, yearStartMonth, yearEndMonth);
    }

    /// @dev Retrieves a volume restriction by its id
    /// @param keyHash Key hash of the restricted thing to retrieve volume restriction details about
    /// @return Volume restriction information
    function maxVolumeByKey(bytes32 keyHash) public view returns(bytes32, uint256, VolumePeriodType, uint8, uint8) {
        return (
            keyHash,
            _maxVolumes[keyHash].volume,
            _maxVolumes[keyHash].periodType,
            _maxVolumes[keyHash].yearStartMonth,
            _maxVolumes[keyHash].yearEndMonth
        );
    }

    /// @dev Add/update the current volume traded by key hash
    /// @param keyHash Key hash of the restricted thing to update current volume details
    /// @param volume Value to change current trade volume to
    /// @param onDate Specified date on which to update current volume (if monthly or yearly will only use month or year component of date)
    function incrementCurrentVolume(bytes32 keyHash, uint256 volume, uint256 onDate) public onlyParentContract() {
        _currentVolumes[getVolumeKey(keyHash, onDate)] = _currentVolumes[getVolumeKey(keyHash, onDate)].add(volume);
    }

    /// @dev Retrieves a current trading volume by its key hash
    /// @param keyHash Key hash of the restricted thing to retrieve volume restriction details about
    /// @param onDate Specified date on which to retrieve current volume (if monthly or yearly will only use month or year component of date)
    /// @return Current trading volume
    function currentVolumeByKey(bytes32 keyHash, uint256 onDate) public view returns(uint256) {
        return _currentVolumes[getVolumeKey(keyHash, onDate)];
    }

    /// @dev Can they trade up to a specified volume
    /// @param keyHash Key hash of the volume restricted thing
    /// @param volume Specified volume to check
    /// @param onDate Specified date on which to check
    /// @return True if they are within their volume limits, False if they have exceeded their volume limits
    function canTrade(bytes32 keyHash, uint256 volume, uint256 onDate) public view returns(bool) {
        return (_currentVolumes[getVolumeKey(keyHash, onDate)].add(volume)) <= _maxVolumes[keyHash].volume;
    }

    function getVolumeKey(bytes32 keyHash, uint256 onDate) internal view returns(bytes32){
        bytes memory key;

        VolumePeriod memory volumePeriod = _maxVolumes[keyHash];

        // break up the date into its components
        (uint256 year, uint256 month, uint256 day) = BokkyPooBahsDateTimeLibrary.timestampToDate(onDate);
        if (volumePeriod.periodType == VolumePeriodType.PerDay) {
            key = abi.encodePacked(keyHash, year, month, day);
        }
        else if (volumePeriod.periodType == VolumePeriodType.PerMonth) {
            key = abi.encodePacked(keyHash, year, month);
        }
        else if (volumePeriod.periodType == VolumePeriodType.PerYear) {
            uint256 adjustedYear = year;
            bool notCalendarYear = volumePeriod.yearEndMonth < volumePeriod.yearStartMonth;
            if (notCalendarYear && month <= volumePeriod.yearEndMonth) {
                adjustedYear = adjustedYear.sub(1);
            }
            key = abi.encodePacked(keyHash, adjustedYear);
        }

        return keccak256(key);
    }    
}