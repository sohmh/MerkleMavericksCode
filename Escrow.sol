// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Escrow {
    address public buyer;
    address public seller;
    address public arbiter;

    enum State { AWAITING_PAYMENT, AWAITING_DELIVERY, COMPLETE, REFUNDED }
    State public currentState;

    event Deposited(address indexed buyer, uint256 amount);
    event DeliveryConfirmed(address indexed buyer, address indexed seller);
    event Refunded(address indexed buyer, uint256 amount);
    event StateChanged(State newState);

    constructor(address _seller, address _arbiter) {
        buyer = msg.sender;
        seller = _seller;
        arbiter = _arbiter;
        currentState = State.AWAITING_PAYMENT;
    }

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Only buyer allowed");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter allowed");
        _;
    }

    function deposit() external payable onlyBuyer {
        require(currentState == State.AWAITING_PAYMENT, "Already paid");
        require(msg.value > 0, "Send ETH");
        currentState = State.AWAITING_DELIVERY;
        emit Deposited(msg.sender, msg.value);
        emit StateChanged(currentState);
    }

    function confirmDelivery() external onlyBuyer {
        require(currentState == State.AWAITING_DELIVERY, "Not ready");
        payable(seller).transfer(address(this).balance);
        currentState = State.COMPLETE;
        emit DeliveryConfirmed(msg.sender, seller);
        emit StateChanged(currentState);
    }

    function refund() external onlyArbiter {
        require(currentState == State.AWAITING_DELIVERY, "Cannot refund");
        payable(buyer).transfer(address(this).balance);
        currentState = State.REFUNDED;
        emit Refunded(buyer, address(this).balance);
        emit StateChanged(currentState);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getState() external view returns (State) {
        return currentState;
    }
}