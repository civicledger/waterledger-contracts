pragma solidity ^0.4.24;

import "./SafeMath.sol";
import "./ERC20.sol";
import "./Ownable.sol";

contract Zone is ERC20, Ownable {
    using SafeMath for uint;

    bytes32 public _name = '';
    bytes32 public _symbol = "CLW";
    uint8 public _decimals = 12;

    uint256 public _min = 0;
    uint256 public _max = 0;

    address private _orderBook;

    constructor(uint256 supply, bytes32 name, address orderBook, uint256 min, uint256 max) public {
        _totalSupply = supply;
        _name = name;
        _orderBook = orderBook;
        _min = min;
        _max = max;
    }

    function isToTransferValid(uint256 value) public view returns (bool) {
        return _totalSupply.add(value) <= _max;
    }

    function isFromTransferValid(uint256 value) public view returns (bool) {
        return _totalSupply.sub(value) >= _min;
    }

    function getTransferLimits() external view returns(uint256, uint256) {
        return (_min, _max);
    }

    function allocate(address to, uint256 value) external onlyOwner() {
        _balances[to] = value;
        _totalSupply = _totalSupply.add(value);
    }

    function orderBookCredit(address to, uint256 value) external onlyOrderBook() returns (bool) {
        if(isToTransferValid(value)){
            _balances[to] = _balances[to].add(value);
            _totalSupply = _totalSupply.add(value);
            emit Transfer(owner(), to, value);
            return true;
        }
        return false;
    }

    function orderBookDebit(address from, uint256 value) external onlyOrderBook() returns (bool) {
        if(isFromTransferValid(value)){
            _balances[from] = _balances[from].sub(value);
            emit Transfer(from, owner(), value);
            return true;
        }
        return false;
    }

    modifier onlyOrderBook() {
        require(address(_orderBook) != address(0), "Orderbook must be set to make this transfer");
        require(_orderBook == msg.sender, "Only the orderbook can make this transfer");
        _;
    }

    event Allocation(address indexed to, uint256 value);
    event Approval(address indexed to, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);
}