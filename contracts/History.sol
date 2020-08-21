pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./QuickSort.sol";

contract History is QuickSort, Ownable {
    using SafeMath for uint;

    enum Status { Pending, Completed, Rejected, Invalid }

    struct Trade {
        bytes32 id;
        address buyer;
        address seller;
        uint256 averagePrice;
        uint256 quantity;
        uint256 timeStamp;
        uint8 fromZone;
        uint8 toZone;
        uint256 buyIndex;
        uint256 sellIndex;
        Status status;
    }

    Trade[] public _history;
    mapping(address => bool) private _allowedWriters;
    mapping(bytes32 => uint256) public _idToHistoryIndex;

    constructor(address orderBook) public {
        _allowedWriters[msg.sender] = true;
        _allowedWriters[orderBook] = true;
    }

    function getTrade(uint256 tradeIndex) public view returns (address, uint256, uint8, uint8, uint256, uint256) {
        Trade memory trade = _history[tradeIndex];
        return (trade.buyer, trade.quantity, trade.toZone, trade.fromZone, trade.buyIndex, trade.sellIndex);
    }

    function getTradeStruct(uint256 tradeIndex) public view returns (Trade memory) {
        return _history[tradeIndex];
    }

    function getHistory(uint256 numberOfTrades) public view returns(Trade[] memory) {
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

    function getTradeById(bytes32 id) public view returns(Trade memory) {
        return _history[_idToHistoryIndex[id]];
    }

    function getLicenceHistory(address licenceAddress) public view returns(Trade[] memory) {

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

    function getTimeHistory() internal view returns(uint256[] memory) {

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

    function addHistory(address buyer, address seller, uint256 price, uint256 quantity, uint8 fromZone, uint8 toZone, uint256 buyIndex, uint256 sellIndex)
            external onlyWriters("Only writers can add history") {
        bytes32 id = createId(block.timestamp, price, quantity, buyer);
        _history.push(Trade(id, buyer, seller, price, quantity, block.timestamp, fromZone, toZone, buyIndex, sellIndex, Status.Pending));

        emit HistoryAdded(id, buyer, seller, price, quantity, fromZone, toZone);
    }

    function createId(uint256 timestamp, uint256 price, uint256 quantity, address user) public pure returns(bytes32) {
        return keccak256(abi.encode(timestamp, price, quantity, user));
    }

    function addManualHistory(address buyer, address seller, uint256 price, uint256 quantity, uint8 fromZone, uint8 toZone, uint256 buyIndex, uint256 sellIndex, uint256 timestamp, Status status)
            external onlyOwner {
        bytes32 id = createId(block.timestamp, price, quantity, buyer);
        _history.push(Trade(id, buyer, seller, price, quantity, timestamp, fromZone, toZone, buyIndex, sellIndex, status));

        emit ManualHistoryAdded(id);
    }

    function rejectTrade(uint256 index) public onlyOwner {
        _history[index].status = Status.Rejected;
        emit TradeRejected(_history[index].id);
    }

    function invalidateTrade(uint256 index) public onlyWriters("Trade can only be invalidated by the orderbook") {
        _history[index].status = Status.Invalid;
        emit TradeInvalidated(_history[index].id);
    }

    function completeTrade(uint256 index) public onlyWriters("Only writers can update history") {
        _history[index].status = Status.Completed;
        emit TradeCompleted(_history[index].id);
    }

    function addWriter(address who) public onlyOwner {
        _allowedWriters[who] = true;
    }

    function denyWriter(address who) public onlyOwner {
        _allowedWriters[who] = false;
    }

    modifier onlyWriters(string memory error) {
        require(_allowedWriters[msg.sender] == true, error);
        _;
    }

    event HistoryAdded(bytes32 id, address buyer, address seller, uint256 price, uint256 quantity, uint8 fromZone, uint8 toZone);
    event ManualHistoryAdded(bytes32 id);
    event TradeCompleted(bytes32 id);
    event TradeInvalidated(bytes32 id);
    event TradeRejected(bytes32 id);
}