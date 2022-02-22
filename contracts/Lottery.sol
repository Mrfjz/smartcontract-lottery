//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract Lottery is Ownable {
    enum LotteryState {
        Opened,
        Closed,
        Finished
    }
    LotteryState public state;
    // Can only draw after this time.
    uint256 public drawTime;

    using EnumerableSet for EnumerableSet.AddressSet;
    mapping(uint256 => EnumerableSet.AddressSet) private entries;

    uint256 public entryFee;
    uint256 public constant smallestDrawNumber = 1;
    uint256 public constant largestDrawNumber = 49;
    uint256 public winningNumber;
    uint256 private numEntries;

    event LotteryStateChanged(LotteryState newState);
    event NewEntry(address player, uint256 number);
    event NumberDrawed(uint256 number);
    event NextDrawScheduled(
        uint256 entryFee,
        uint256 drawTime
    );

    modifier isState(LotteryState _state) {
        require(state == _state, "Invalid state for the action");
        _;
    }

    constructor(
        uint256 _entryFee,
        uint256 _drawTime
    ) Ownable() {
        require(_entryFee > 0, "Entry fee must be positive");
        entryFee = _entryFee;
        drawTime = _drawTime;
    }

    /// Set the entry fee, and next draw time.
    function scheduleNextDraw(
        uint256 _entryFee,
        uint256 _drawTime
    ) public isState(LotteryState.Finished) onlyOwner {
        require(_entryFee > 0, "Entry fee must be positive");
        entryFee = _entryFee;
        drawTime = _drawTime;
        winningNumber = 0;
        for (uint256 i = smallestDrawNumber; i <= largestDrawNumber; i++) {
            delete entries[i];
        }
        numEntries = 0;
        _changeState(LotteryState.Opened);
        emit NextDrawScheduled(_entryFee, _drawTime);
    }

    /// Submit a number
    function submitNumber(uint256 _number)
        public
        payable
        isState(LotteryState.Opened)
    {
        require(msg.value >= entryFee, "Minimum entry fee required");
        require(_number >= smallestDrawNumber, "Number too small");
        require(_number <= largestDrawNumber, "Number too large");
        require(entries[_number].add(msg.sender), "Number already submitted");
        numEntries++;
        emit NewEntry(msg.sender, _number);
    }

    /// Draw the number, transfer the prize to winners, 
    function drawNumber() public isState(LotteryState.Opened) {
        require(block.timestamp >= drawTime, "Too early to draw");
        _changeState(LotteryState.Closed);
        winningNumber = randomNumber();
        emit NumberDrawed(winningNumber);
        EnumerableSet.AddressSet storage addressSet = entries[winningNumber];
        uint256 balance = address(this).balance;
        uint256 numWinner = addressSet.length();
        if (numWinner > 0) {
            uint256 winningPrize = balance / numWinner;
            for (uint256 i = 0; i < numWinner; i++) {
                payable(addressSet.at(i)).transfer(winningPrize);
            }
        }
        _changeState(LotteryState.Finished);
    }

    function randomNumber() private view returns (uint256) {
        address[] memory _addresses = new address[](numEntries);
        uint256[] memory _numbers = new uint256[](numEntries);

        uint256 _count = 0;
        for (uint256 i = smallestDrawNumber; i <= largestDrawNumber; i++) {
            EnumerableSet.AddressSet storage addressSet = entries[i];
            for (uint256 j = 0; j < addressSet.length(); j++) {
                _addresses[_count] = addressSet.at(j);
                _numbers[_count] = i;
            }
        }
        // An attacker might figure out the winning number during mining stage.
        // However, if the attacker submit the winning number, the _addresses and _numbers changes,
        // which cause the winnning number to change as well.
        return
            (uint256(
                keccak256(
                    abi.encodePacked(
                        block.difficulty,
                        block.timestamp,
                        _addresses,
                        _numbers
                    )
                )
            ) % (largestDrawNumber)) + smallestDrawNumber;
    }

    function _changeState(LotteryState _state) private {
        state = _state;
        emit LotteryStateChanged(state);
    }

    function getState() public view returns (LotteryState){
        return state;
    }
}
