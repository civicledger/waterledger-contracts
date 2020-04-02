pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./SafeMath.sol";
import "./QuickSort.sol";
import "./Ownable.sol";

contract History is QuickSort, Ownable {
    using SafeMath for uint;

    enum Status { Pending, Completed, Rejected, Invalid }
    enum Period { N_A, Three_Months, Six_Months, Nine_Months, One_Year }

    struct Trade {
        address buyer;
        address seller;
        uint256 averagePrice;
        uint256 quantity;
        uint256 timeStamp;
        uint8 fromZone;
        uint8 toZone;
        uint256 buyIndex;
        uint256 sellIndex;
        Period period;
        Status status;
    }

    Trade[] public _history;
    mapping(address => bool) private _allowedWriters;

    constructor(address orderBook) public {
        _allowedWriters[msg.sender] = true;
        _allowedWriters[orderBook] = true;
    }

    function getTrade(uint256 tradeIndex) public view returns (address, uint256, uint8, uint8, uint256, uint256) {
        Trade memory trade = _history[tradeIndex];
        return (trade.buyer, trade.quantity, trade.toZone, trade.fromZone, trade.buyIndex, trade.sellIndex);
    }

    function getTradeStruct(uint256 tradeIndex) public view returns (Trade) {
        return _history[tradeIndex];
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

    function getLicenceHistory(address licenceAddress) public view returns(Trade[]) {

        uint256 max = getLicenceTradeCount(licenceAddress);
        Trade[] memory returnedTrades = new Trade[](max);

        uint256 currentIndex = 0;

        for(uint256 i; i < _history.length; i++) {
            if(_history[i].buyer == licenceAddress || _history[i].seller == licenceAddress) {
                returnedTrades[currentIndex] = _history[i];
                currentIndex++;
            }
        }

        return returnedTrades;
    }

    function getLicenceTradeCount(address licenceAddress) public view returns(uint256) {
        uint256 tradeCount = 0;
        for(uint256 i; i < _history.length; i++) {
            if(_history[i].buyer == licenceAddress || _history[i].seller == licenceAddress) {
                tradeCount++;
            }
        }
        return tradeCount;
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

    function addHistory(address buyer, address seller, uint256 price, uint256 quantity, uint8 fromZone, uint8 toZone, uint256 buyIndex, uint256 sellIndex, Period period)
            external onlyWriters("Only writers can add history") {
        require(buyer != address(0), "Invalid address");
        require(seller != address(0), "Invalid address");
        _history.push(Trade(buyer, seller, price, quantity, now, fromZone, toZone, buyIndex, sellIndex, period, Status.Pending));

        emit HistoryAdded(_history.length - 1, buyer, seller, price, quantity, fromZone, toZone);
    }

    function rejectTrade(uint256 index) public onlyOwner {
        _history[index].status = Status.Rejected;
        emit TradeRejected(index);
    }

    function invalidateTrade(uint256 index) public onlyWriters("Trade can only be invalidated by the orderbook") {
        _history[index].status = Status.Invalid;
        emit TradeInvalidated(index);
    }

    function completeTrade(uint256 index) public onlyWriters("Only writers can update history") {
        _history[index].status = Status.Completed;
        emit TradeCompleted(index);
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
    event TradeCompleted(uint256 index);
    event TradeInvalidated(uint256 index);
    event TradeRejected(uint256 index);
}