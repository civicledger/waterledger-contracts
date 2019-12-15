pragma solidity ^0.4.24;

import "./History.sol";

contract HistoryTesting is History {
    function manualHistoryAdd(address buyer, address seller, uint256 price, uint256 quantity, uint timeStamp) public {

        _history.push(Trade(buyer, seller, price, quantity, timeStamp));

        emit HistoryAdded(buyer, seller, price, quantity);
    }
}