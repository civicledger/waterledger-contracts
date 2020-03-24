pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./SafeMath.sol";
import "./QuickSort.sol";
import "./Ownable.sol";

contract History is QuickSort, Ownable {
    using SafeMath for uint;

    enum Status { Pending, Completed, Rejected }
    enum Period { N_A, Three_Months, Six_Months, Nine_Months, One_Year }

    struct Trade {
        address buyer;
        address seller;
        uint256 averagePrice;
        uint256 quantity;
        uint256 timeStamp;
        uint8 fromZone;
        uint8 toZone;
        Period period;
        Status status;
    }

    Trade[] public _history;
    mapping(address => bool) private _allowedWriters;

    constructor(address orderBook) public {
        _allowedWriters[msg.sender] = true;
        _allowedWriters[orderBook] = true;
    }

    function getTrade(uint256 tradeIndex) public view returns (address, uint256, uint8) {
        return (_history[tradeIndex].buyer, _history[tradeIndex].quantity, _history[tradeIndex].toZone);
    }

    function getHistory(uint256 numberOfTrades) public view returns(Trade[]) {
        uint256 max = _history.length < numberOfTrades ? _history.length : numberOfTrades;

        if (max > 1000) {
            max = 1000;
        }

        uint256[] memory sortedIndexes = getTimeHistory();
        Trade[] memory returnedTrades = new Trade[](max);

        for(uint256 i = 0; i < max; i++) {
            returnedTrades[i] = _history[sortedIndexes[i]];
        }

        return returnedTrades;
    }

    function getTradeCount() public view returns (uint) {
        return _history.length;
    }

    function getTimeHistory() internal view returns(uint256[]) {

        uint256[] memory timeStamps = new uint256[](_history.length);
        uint256[] memory indexes = new uint256[](_history.length);

        if (_history.length == 0) {
            return indexes;
        }

        for (uint i = 0; i < _history.length; i++) {
            timeStamps[i] = _history[i].timeStamp;
            indexes[i] = i;
        }

        uint256[] memory sortedIndexes = reverseSortWithIndex(timeStamps, indexes);
        return sortedIndexes;
    }

    function addHistory(address buyer, address seller, uint256 price, uint256 quantity, uint8 fromZone, uint8 toZone, Period period)
        external onlyWriters("Only writers can add history") {
        require(buyer != address(0), "Invalid address");
        require(seller != address(0), "Invalid address");
        _history.push(Trade(buyer, seller, price, quantity, now, fromZone, toZone, period, Status.Pending));

        emit HistoryAdded(_history.length - 1, buyer, seller, price, quantity, fromZone, toZone);
    }

    function rejectTrade(uint256 index) public onlyOwner {
        _history[index].status = Status.Rejected;
    }

    function completeTrade(uint256 index) public onlyWriters("Only writers can update history") {
        _history[index].status = Status.Completed;
    }

    function addWriter(address who) public onlyOwner {
        _allowedWriters[who] = true;
    }

    function denyWriter(address who) public onlyOwner {
        _allowedWriters[who] = false;
    }

    modifier onlyWriters(string error) {
        require(_allowedWriters[msg.sender] == true, error);
        _;
    }

    event HistoryAdded(uint256 index, address buyer, address seller, uint256 price, uint256 quantity, uint8 fromZone, uint8 toZone);
}