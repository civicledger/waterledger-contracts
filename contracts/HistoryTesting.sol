pragma solidity ^0.4.24;

import "./History.sol";

contract HistoryTesting is History {

    function manualHistoryAdd(address buyer, address seller, uint256 price, uint256 quantity, uint timeStamp, uint8 fromZone, uint8 toZone )
            public {

        _history.push(Trade(buyer, seller, price, quantity, timeStamp, fromZone, toZone, Status.Pending));

        emit HistoryAdded(_history.length - 1, buyer, seller, price, quantity, fromZone, toZone);
    }
}