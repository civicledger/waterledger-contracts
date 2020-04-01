pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";
import "./Zone.sol";
import "./QuickSort.sol";
import "./SafeMath.sol";
import "./History.sol";
import "./Licences.sol";

contract OrderBook is QuickSort, Ownable {
    using SafeMath for uint;

    Zone[] public _zones;
    bytes32[] public _zoneNames;
    History public _history;
    Licences public _licences;

    uint256 public _lastTradedPrice;

    enum OrderType { Sell, Buy }

    struct Order {
        OrderType orderType;
        History.Period period;
        address owner;
        uint256 price;
        uint256 quantity;
        uint256 timeStamp;
        uint256 matchedTimeStamp;
        uint8 zone;
    }

    Order[] public _buys;
    Order[] public _sells;

    function addZone(bytes32 name, address zoneContract) public onlyOwner {
        _zones.push(Zone(zoneContract));
        _zoneNames.push(name);
    }

    function getZones() public view returns(address[]) {
        address[] memory zones = new address[](_zones.length);

        for(uint i; i < _zones.length; i++) {
            zones[i] = address(_zones[i]);
        }
        return zones;
    }

    function addHistoryContract(address historyContract) public onlyOwner {
        _history = History(historyContract);
    }

    function addLicencesContract(address licencesContract) public onlyOwner {
        _licences = Licences(licencesContract);
    }

    function validateTrade(uint tradeIndex) public onlyOwner returns (bool) {
        (address buyer, uint quantity, uint8 toZone, uint8 fromZone, uint256 buyIndex, uint256 sellIndex) = _history.getTrade(tradeIndex);

        if(toZone == fromZone){
            return true;
        }

        if(!_zones[toZone].isToTransferValid(quantity)) {
            _buys[buyIndex].matchedTimeStamp = 0;
            _sells[sellIndex].matchedTimeStamp = 0;
            _history.invalidateTrade(tradeIndex);
        }

        if(!_zones[fromZone].isFromTransferValid(quantity)) {
            _buys[buyIndex].matchedTimeStamp = 0;
            _sells[sellIndex].matchedTimeStamp = 0;
            _history.invalidateTrade(tradeIndex);
        }

        return true;
    }

    function completeTrade(uint256 tradeIndex) public onlyOwner {
        (address buyer, uint quantity, uint8 toZone, uint8 fromZone, uint256 buyIndex, uint256 sellIndex) = _history.getTrade(tradeIndex);
        _history.completeTrade(tradeIndex);
        _zones[toZone].orderBookCredit(buyer, quantity);
    }

    function getLastTradedPrice() public view returns (uint256) {
        return _lastTradedPrice;
    }

    function addSellLimitOrder(uint256 price, uint256 quantity, uint8 zoneIndex) public {
        Zone zone = _zones[zoneIndex];
        require(quantity > 0 && price > 0, "Values must be greater than 0");
        require(zone.balanceOf(msg.sender) >= quantity, "Insufficient water allocation");

        uint256 sellCount = _sells.push(Order(OrderType.Sell, History.Period.N_A, msg.sender, price, quantity, now, 0, zoneIndex));
        uint256 sellIndex = sellCount - 1;
        zone.orderBookDebit(msg.sender, quantity);

        emit SellOrderAdded();

        bool isUnmatched = true;

        if (_buys.length > 0) {

            uint256 i = 0;
            uint256[] memory sortedIndexes = getPriceTimeBuyOrders();

            while (isUnmatched && i < sortedIndexes.length) {

                uint256 j = sortedIndexes[i];

                if (_buys[j].matchedTimeStamp == 0 && _buys[j].price >= price && _buys[j].quantity == quantity && _buys[j].owner != msg.sender) {
                    _history.addHistory(msg.sender, _buys[j].owner, _buys[j].price, _buys[j].quantity, zoneIndex, _buys[j].zone, j, sellIndex, History.Period.N_A);
                    _buys[j].matchedTimeStamp = now;
                    _sells[sellIndex].matchedTimeStamp = now;

                    isUnmatched = false;
                    _lastTradedPrice = _buys[j].price;
                    emit Matched();
                }

                i++;
            }
        }
    }

    function addBuyLimitOrder(uint256 price, uint256 quantity, uint8 zoneIndex, History.Period period) public {
        require(quantity > 0 && price > 0, "Values must be greater than 0");

        //Push to array first
        uint256 buyIndex = _buys.push(Order(OrderType.Buy, period, msg.sender, price, quantity, now, 0, zoneIndex)) - 1;

        emit BuyOrderAdded();

        bool isUnmatched = true;

        if (_sells.length > 0) {

            uint256 i = 0;
            uint256[] memory sortedIndexes = getPriceTimeSellOrders();

            while (isUnmatched && i < sortedIndexes.length) {

                uint256 j = sortedIndexes[i];

                if ( _sells[j].matchedTimeStamp == 0 && _sells[j].price <= price && _sells[j].quantity == quantity && _sells[j].owner != msg.sender) {
                    _history.addHistory(msg.sender, _sells[j].owner, _sells[j].price, _sells[j].quantity, _sells[j].zone, zoneIndex, buyIndex, j, period);

                    _sells[j].matchedTimeStamp = now;
                    _buys[buyIndex].matchedTimeStamp = now;

                    _lastTradedPrice = _sells[j].price;
                    isUnmatched = false;
                    emit Matched();
                }

                i++;
            }
        }
    }

    function getOrderBook() public view returns (Order[]) {
        uint256 totalLength = getUnmatchedSellsCount() + getUnmatchedBuysCount();

        Order[] memory returnedOrders = new Order[](totalLength);

        for(uint256 i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0) {
                returnedOrders[i] = _sells[i];
            }
        }

        for(uint256 j = 0; j < _buys.length; j++) {
            if (_buys[j].matchedTimeStamp == 0) {
                returnedOrders[_sells.length + j] = _buys[j];
            }
        }

        return returnedOrders;
    }

    function getOrderBookSells(uint256 numberOfOrders) public view returns (Order[]) {

        uint256 max = getUnmatchedSellsCount() < numberOfOrders ? getUnmatchedSellsCount() : numberOfOrders;

        if (max > 10) {
            max = 10;
        }

        uint256[] memory sortedIndexes = getPriceTimeSellOrders();

        Order[] memory returnedOrders = new Order[](max);

        for(uint256 i = 0; i < max; i++) {
            returnedOrders[i] = _sells[sortedIndexes[i]];
        }

        return returnedOrders;
    }

    function getOrderBookBuys(uint256 numberOfOrders) public view returns (Order[]) {

        uint256 max = getUnmatchedBuysCount() < numberOfOrders ? getUnmatchedBuysCount() : numberOfOrders;

        if (max > 10) {
            max = 10;
        }

        uint256[] memory sortedIndexes = getPriceTimeBuyOrders();

        Order[] memory returnedOrders = new Order[](max);

        for(uint256 i = 0; i < max; i++) {
            returnedOrders[i] = _buys[sortedIndexes[i]];
        }

        return returnedOrders;
    }

    function lowestSell() public view returns(Order) {
        require(getUnmatchedSellsCount() > 0, "No sells available");
        uint256[] memory sortedIndexes = getPriceTimeSellOrders();

        uint i = sortedIndexes[0];
        return _sells[i];
    }

    function highestBuy() public view returns(Order) {
        require(getUnmatchedBuysCount() > 0, "No buys available");

        uint256[] memory sortedIndexes = getPriceTimeBuyOrders();

        uint i = sortedIndexes[0];
        return _buys[i];
    }

    function getPriceTimeSellOrders() internal view returns(uint256[]) {
        uint256 count = getUnmatchedSellsCount();

        uint256[] memory prices = new uint256[](count);
        uint256[] memory indexes = new uint256[](count);

        if (count == 0) {
            return indexes;
        }

        uint j = 0;
        for (uint i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0) {
                prices[j] = _sells[i].price;
                indexes[j] = i;
                j += 1;
            }
        }

        uint256[] memory sortedIndexes = sortWithIndex(prices, indexes);
        return sortedIndexes;
    }

    function getPriceTimeBuyOrders() internal view returns(uint256[]) {
        uint256 count = getUnmatchedBuysCount();

        uint256[] memory prices = new uint256[](count);
        uint256[] memory indexes = new uint256[](count);

        if (count == 0) {
            return indexes;
        }

        uint j = 0;
        for (uint i = 0; i < _buys.length; i++) {
            if (_buys[i].matchedTimeStamp == 0) {
                prices[j] = _buys[i].price;
                indexes[j] = i;
                j += 1;
            }
        }

        uint256[] memory sortedIndexes = reverseSortWithIndex(prices, indexes);
        return sortedIndexes;
    }

    function getSellsCount() public view returns (uint) {
        return _sells.length;
    }

    function getUnmatchedSellsCount() internal view returns (uint) {
        uint count = 0;
        for (uint i = 0; i < _sells.length; i++) {
            if (_sells[i].matchedTimeStamp == 0) {
                count++;
            }
        }

        return count;
    }

    function getBuysCount() public view returns (uint) {
        return _buys.length;
    }

    function getUnmatchedBuysCount() internal view returns (uint) {
        uint count = 0;
        for (uint i = 0; i < _buys.length; i++) {
            if (_buys[i].matchedTimeStamp == 0) {
                count++;
            }
        }

        return count;
    }

    event BuyOrderAdded();
    event SellOrderAdded();
    event Matched();
}