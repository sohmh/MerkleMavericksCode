from algokit_utils import ApplicationClient, get_account_from_mnemonic, get_algod_client
from smart_contracts.artifacts.escrow.escrow_client import APP_SPEC
import os


def deploy():
    algod = get_algod_client()

    mnemonic = os.getenv("DEPLOYER_MNEMONIC")
    if not mnemonic:
        raise ValueError("DEPLOYER_MNEMONIC is not set")

    account = get_account_from_mnemonic(mnemonic)

    # Use generated app spec from escrow_client.py with legacy ApplicationClient.
    app_client = ApplicationClient(
        algod,
        APP_SPEC,
        signer=account,
    )

    app_id, _, _ = app_client.create()

    print("Application created")
    print("App ID:", app_id)