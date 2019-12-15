pragma solidity ^0.4.24;

import "./SafeMath.sol";
import "./ERC20.sol";
import "./Ownable.sol";

contract Water is ERC20, Ownable {
    using SafeMath for uint;

    // Public variables of the token
    string public _name = "Water Ledger Water";
    string public _symbol = "CLW";
    uint8 public _decimals = 12; //megalitres

    address public _orderBook;
    address public _waterLicenceAddress;

    constructor(uint256 supply) public {
        _totalSupply = supply;
        _balances[msg.sender] = supply;
    }

    function allocate(address to, uint256 amount) external {
        require(msg.sender == _waterLicenceAddress, "Only water licence can allocate water.");

        _balances[owner()] = _balances[owner()].sub(amount);
        _balances[to] = _balances[to].add(amount);

        emit Allocation(to, amount);
    }

    function setWaterLicence(address _address) public onlyOwner {
        _waterLicenceAddress = _address;
    }

    function setOrderBook(address orderBook) public {
        _orderBook = orderBook;
    }

    function orderBookCredit(address to, uint256 value) external onlyOrderBook() returns (bool) {
        _balances[owner()] = _balances[owner()].sub(value);
        _balances[to] = _balances[to].add(value);

        emit Transfer(owner(), to, value);
        return true;
    }

    function orderBookDebit(address from, uint256 value) external onlyOrderBook() returns (bool) {
        _balances[from] = _balances[from].sub(value);
        _balances[owner()] = _balances[owner()].add(value);

        emit Transfer(from, owner(), value);
        return true;
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