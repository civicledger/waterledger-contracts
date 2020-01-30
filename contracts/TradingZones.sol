pragma solidity ^0.4.24;

import "./Ownable.sol";

/// @title Stores details on water trading zones for a jurisdiction
/// @author Civic Ledger
contract TradingZones is Ownable {

    struct TradingZone {
        string name;
        bool exists;
    }

    TradingZone[] _tradingZones;

    constructor() public {
        _tradingZones.push(TradingZone("", false));
    }

    /// @dev Tests whether the trading zone exists
    /// @param id Id of the trading zone to test
    /// @return True if trading zone exists, false otherwise
    function isTradingZone(uint256 id) public view returns(bool) {
        return id < _tradingZones.length ? _tradingZones[id].exists : false;
    }

    /// @dev Retrieves a trading zone by its id
    /// @param id Id of the trading zone to return
    /// @return Trading zone details
    function tradingZoneById(uint256 id) public view returns(string, bool) {
        TradingZone memory tradingZone = (id >= _tradingZones.length) ? _tradingZones[0] : _tradingZones[id];
        return (
            tradingZone.name,
            tradingZone.exists
        );
    }

    /// @dev Retrieves the number of trading zones registered
    /// @return Trading zones count
    function tradingZonesCount() public view returns(uint256) {
        return _tradingZones.length;
    }

    /// @dev Registers a new trading zone
    /// @param name Trading zone name
    function addTradingZone(string name) public onlyOwner {
        _tradingZones.push(TradingZone(name, true));
    }
}
