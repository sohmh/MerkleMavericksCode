from algopy import ARC4Contract, UInt64, Account, Txn, itxn, arc4, GlobalState


class Escrow(ARC4Contract):

    def __init__(self) -> None:
        self.buyer = GlobalState(Account)
        self.seller = GlobalState(Account)
        self.arbiter = GlobalState(Account)
        self.amount = GlobalState(UInt64)
        self.state = GlobalState(UInt64)

    @arc4.abimethod
    def init(self, seller: Account, arbiter: Account) -> None:
        self.buyer.value = Txn.sender
        self.seller.value = seller
        self.arbiter.value = arbiter

        self.state.value = UInt64(0)

    @arc4.abimethod
    def deposit(self) -> None:
        assert self.state.value == UInt64(0), "Already paid"
        assert Txn.sender == self.buyer.value, "Only buyer"
        assert Txn.amount > UInt64(0), "Send ALGO"

        self.amount.value = Txn.amount
        self.state.value = UInt64(1)

    @arc4.abimethod
    def confirm(self) -> None:
        assert self.state.value == UInt64(1), "Not ready"
        assert Txn.sender == self.arbiter.value, "Only arbiter"

        itxn.Payment(
            receiver=self.seller.value,
            amount=self.amount.value
        ).submit()

        self.state.value = UInt64(2)

    @arc4.abimethod
    def refund(self) -> None:
        assert self.state.value == UInt64(1), "Cannot refund"
        assert Txn.sender == self.arbiter.value, "Only arbiter"

        itxn.Payment(
            receiver=self.buyer.value,
            amount=self.amount.value
        ).submit()

        self.state.value = UInt64(3)

    @arc4.abimethod
    def get_state(self) -> UInt64:
        return self.state.value

    @arc4.abimethod
    def get_amount(self) -> UInt64:
        return self.amount.value