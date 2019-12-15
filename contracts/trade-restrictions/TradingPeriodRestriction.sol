pragma solidity ^0.4.24;

import "./TradeRestriction.sol";

/// @title Restricts trading to a valid period of time, i.e start and expiry.
/// @author Civic Ledger
contract TradingPeriodRestriction is TradeRestriction {

    struct TradingPeriod {
        uint256 startDate;
        uint256 endDate;
    }

    mapping(bytes32 => TradingPeriod[]) _tradingPeriods;

    /// @dev Adds a valid trading period for something identified by keyHash (can add multiple trading periods for a keyHash)
    /// @param keyHash Key hash of the thing to be restricted
    /// @param start Start date of the trading period
    /// @param end End date (expiry) of the trading period
    function addTradingPeriod(bytes32 keyHash, uint256 start, uint256 end) public onlyParentContract() {

        require(start < end || end == 0, "Start date must be before end date");
        _tradingPeriods[keyHash].push(TradingPeriod(start, end));
    
    }

    /// @dev Updates a valid trading period with different start and end dates.
    /// @param keyHash Key hash of the thing to be restricted
    /// @param periodIndex Index of the trading period to change, as there can be multiple periods added
    /// @param start New start date of the trading period
    /// @param end New end date (expiry) of the trading period
    function changeTradingPeriod(bytes32 keyHash, uint256 periodIndex, uint256 start, uint256 end) public onlyParentContract() {

        require(start < end || end == 0, "Start date must be before end date");
    
        _tradingPeriods[keyHash][periodIndex].startDate = start;
        _tradingPeriods[keyHash][periodIndex].endDate = end;
    
    }

    /// @dev Retrieves a trading period related to keyHash at period index 
    /// @param keyHash Key hash of the thing being restricted
    /// @param periodIndex Index of the trading period to retrieve
    /// @return Start date and end date of the trading period
    function tradingPeriodByKey(bytes32 keyHash, uint256 periodIndex) public view returns(uint256, uint256) {
        return (
            _tradingPeriods[keyHash][periodIndex].startDate,
            _tradingPeriods[keyHash][periodIndex].endDate
        );
    }

    /// @dev Retrieves the count of trading periods related to keyHash, to support iteration 
    /// @param keyHash Key hash of the thing being restricted
    /// @return Count of trading period related to keyHash
    function tradingPeriodCountByKey(bytes32 keyHash) public view returns(uint256) {
        return  _tradingPeriods[keyHash].length;        
    }


    /// @dev Determines whether a party can trade based on their trading period 
    /// @param keyHash Key hash of the thing being restricted
    /// @param onDate Date to test for validity
    /// @return True if they have a valid trading period, false if they do not have a valid trading period
    function canTrade(bytes32 keyHash, uint256 onDate) public view returns(bool) {

        for (uint256 i = 0; i < _tradingPeriods[keyHash].length; i++) {

            bool hasNoEndDate = _tradingPeriods[keyHash][i].endDate == 0;
        
            // is there a trading period that the onDate is within
            if (_tradingPeriods[keyHash][i].startDate <= onDate && (_tradingPeriods[keyHash][i].endDate > onDate || hasNoEndDate)) {
                return true;
            }
        
        }
        
        return false;

    }
}