pragma solidity ^0.4.24;

import "./Ownable.sol";
import "./SafeMath.sol";

contract Stats is Ownable {

    using SafeMath for uint;

    uint256 public _volumeAvailable;
    uint256 public _inTransitAmount;
    uint256 public _yesterdayAverageBid;
    uint256 public _yesterdayMinBid;
    uint256 public _yesterdayMaxBid;
    uint256 public _lastTradePrice = 0;

    address public _parentContract;

    mapping(address => bool) private _allowedWriters;

    constructor(uint256 volume, uint256 inTransit, uint256 avg, uint256 min, uint256 max) public {
        _allowedWriters[msg.sender] = true;
        _parentContract = msg.sender;
        _volumeAvailable = volume;
        _inTransitAmount = inTransit;
        _yesterdayAverageBid = avg;
        _yesterdayMinBid = min;
        _yesterdayMaxBid = max;
    }

    function setLastTradePrice(uint256 lastTradePrice) public onlyWriters("Only writers can set the last traded price") {
        require(lastTradePrice > 0, "Trade price must be greater than zero");
        _lastTradePrice = lastTradePrice;
        emit StatsChanged();
    }

    function setVolumeAvailable(uint volume) public onlyWriters("Only writers can set volume") {
        require(volume > 0, "Volume must be greater than zero");
        _volumeAvailable = volume;
        emit StatsChanged();
    }

    function updateVolumeAvailable(uint volume) public onlyWriters("Only writers can set volume") {
        require(volume > 0, "Volume must be greater than zero");
        _volumeAvailable = _volumeAvailable.add(volume);
        emit StatsChanged();
    }

    function reduceVolumeAvailable(uint volume) public onlyWriters("Only writers can set volume") {
        require(volume > 0, "Volume must be greater than zero");
        _volumeAvailable = _volumeAvailable.sub(volume);
        emit StatsChanged();
    }

    function setInTransitAmount(uint inTransit) public onlyWriters("Only writers can change stats") {
        _inTransitAmount = inTransit;
        emit StatsChanged();
    }

    function setStats(
        uint256 volume,
        uint256 inTransit,
        uint256 avg,
        uint256 min,
        uint256 max
    ) public onlyWriters("Only writers can change stats") {
        _volumeAvailable = volume;
        _inTransitAmount = inTransit;
        _yesterdayAverageBid = avg;
        _yesterdayMinBid = min;
        _yesterdayMaxBid = max;
    }

    function getAllStats() public view returns (
        uint256 volume,
        uint256 inTransit,
        uint256 avg,
        uint256 min,
        uint256 max
    ) {
        return (_volumeAvailable, _inTransitAmount, _yesterdayAverageBid, _yesterdayMinBid, _yesterdayMaxBid);
    }

    function addWriter(address who) public onlyOwner {
        _allowedWriters[who] = true;
    }

    function denyWriter(address who) public onlyOwner {
        _allowedWriters[who] = false;
    }

    event StatsChanged();
    event WriterRequested(address from, address parent, bool found);

    modifier onlyWriters(string error) {
        require(_allowedWriters[msg.sender] == true, error);
        _;
    }
}