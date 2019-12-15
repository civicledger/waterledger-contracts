Trapragma solidity ^0.4.24;

import "./SafeMath.sol";
import "./QuickSort.sol";
import "./Ownable.sol";

contract History is QuickSort, Ownable {
    using SafeMath for uint;

    struct Trade {
        address buyer;
        address seller;
        uint256 averagePrice;
        uint256 quantity;
        uint256 timeStamp;
    }

    Trade[] public _history;
    mapping(address => bool) private _allowedWriters;

    constructor() public {
        _allowedWriters[msg.sender] = true;
    }

    function averageValueTradedInPeriod(uint256 from, uint256 to) public view returns(uint256) {
        uint256 total = 0;
        uint256 numberOfMatches = 0;

        for (uint i = 0; i < _history.length; i++) {
            if (_history[i].timeStamp >= from && _history[i].timeStamp <= to) {
                total = total.add(_history[i].averagePrice);
                numberOfMatches++;
            }
        }

        if (numberOfMatches == 0) {
            return 0;
        }

        return total.div(numberOfMatches);
    }

    function totalValueTradedInPeriod(uint256 from, uint256 to) public view returns(uint256) {
        uint256 total = 0;

        for (uint i = 0; i < _history.length; i++) {
            if (_history[i].timeStamp >= from && _history[i].timeStamp <= to) {
                total = total.add(_history[i].averagePrice);
            }
        }

        return total;
    }

    function totalVolumeTradedInPeriod(uint256 from, uint256 to) public view returns(uint256) {
        uint256 total = 0;

        for (uint i = 0; i < _history.length; i++) {
            if (_history[i].timeStamp >= from && _history[i].timeStamp <= to) {
                total = total.add(_history[i].quantity);
            }
        }

        return total;
    }

    function getHistory(uint256 numberOfTrades) public view returns(address[], address[], uint256[], uint256[], uint256[]) {
        uint256 max = _history.length < numberOfTrades ? _history.length : numberOfTrades;

        if (max > 1000) {
            max = 1000;
        }

        uint256[] memory sortedIndexes = getTimeHistory();

        address[] memory buyers = new address[](max);
        address[] memory sellers = new address[](max);
        uint256[] memory averagePrices = new uint256[](max);
        uint256[] memory quantities = new uint256[](max);
        uint256[] memory timeStamps = new uint256[](max);

        for(uint256 i = 0; i < max; i++) {
            buyers[i] = _history[sortedIndexes[i]].buyer;
            sellers[i] = _history[sortedIndexes[i]].seller;
            averagePrices[i] = _history[sortedIndexes[i]].averagePrice;
            quantities[i] = _history[sortedIndexes[i]].quantity;
            timeStamps[i] = _history[sortedIndexes[i]].timeStamp;
        }

        return (buyers, sellers, averagePrices, quantities, timeStamps);
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

    function addHistory(address buyer, address seller, uint256 price, uint256 quantity) external onlyWriters("Only writers can add history") {
        require(buyer != address(0), "Invalid address");
        require(seller != address(0), "Invalid address");
        _history.push(Trade(buyer, seller, price, quantity, now));

        emit HistoryAdded(buyer, seller, price, quantity);
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

    event HistoryAdded(address buyer, address seller, uint256 price, uint256 quantity);
}