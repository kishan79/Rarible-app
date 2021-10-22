import { SellRequest } from "@rarible/protocol-ethereum-sdk/build/order/sell";
import React, { useState } from "react";
import {
  isErc1155v1Collection,
  isErc1155v2Collection,
  isErc721v1Collection,
  isErc721v2Collection,
  isErc721v3Collection,
  RaribleSdk,
} from "@rarible/protocol-ethereum-sdk";
import { toAddress, toBigNumber } from "@rarible/types";
import { NftCollection_Type, NftItem } from "@rarible/protocol-api-client";
import { debounce } from "./utils/debounce";
import { retry } from "./utils/retry";

const MintForm = {
  id: "0x6ede7f3c26975aad32a475e1021d8f6f39c89d82", // default collection on "rinkeby" that supports lazy minting
  type: "ERC721",
  isLazy: true,
  isLazySupported: true,
  loading: false,
};

const Dashboard = ({ provider, sdk, accounts }) => {
  const [collection, setCollection] = useState(MintForm);
  const [ownedItems, setOwnedItems] = useState();
  const [bidOrders, setBidOrders] = useState();
  const [createOrderForm, setCreateOrderForm] = useState({
    contract: "",
    tokenId: "",
    price: "10",
    hash: "",
  });
  const [createBidForm, setCreateBidForm] = useState({
    contractErc20Address: "",
    contractErc721Address: "",
    tokenId: "",
    sellerAddress: "",
    buyerAddress: "",
    bidPrice: 0,
  });
  const [fetchBidForm, setFetchBidForm] = useState({
    contract: "0x6ede7f3c26975aad32a475e1021d8f6f39c89d82",
    tokenId:
      "97518271989509997173020514786102219480471206413775186524097045951319598170135",
  });
  const [purchaseOrderForm, setPurchaseOrderForm] = useState({
    hash: "",
    amount: "1",
  });
  const connectWalletHandler = () => {
    provider.request({ method: "eth_requestAccounts" });
  };

  const mint = async () => {
    let tokenId;
    const nftCollection = await sdk.apis.nftCollection.getNftCollectionById({
      collection: collection.id,
    });
    if (isErc721v3Collection(nftCollection)) {
      const resp = await sdk.nft.mint({
        collection: nftCollection,
        uri: "/ipfs/QmWLsBu6nS4ovaHbGAXprD1qEssJu4r5taQfB74sCG51tp",
        creators: [{ account: toAddress(accounts[0]), value: 10000 }],
        royalties: [],
        lazy: collection.isLazy,
      });
      tokenId = resp.tokenId;
    } else if (isErc1155v2Collection(nftCollection)) {
      const resp = await sdk.nft.mint({
        collection: nftCollection,
        uri: "/ipfs/QmWLsBu6nS4ovaHbGAXprD1qEssJu4r5taQfB74sCG51tp",
        creators: [{ account: toAddress(accounts[0]), value: 10000 }],
        royalties: [],
        supply: 1,
        lazy: collection.isLazy,
      });
      tokenId = resp.tokenId;
    } else if (isErc721v2Collection(nftCollection)) {
      const resp = await sdk.nft.mint({
        collection: nftCollection,
        uri: "/ipfs/QmWLsBu6nS4ovaHbGAXprD1qEssJu4r5taQfB74sCG51tp",
        royalties: [],
      });
      tokenId = resp.tokenId;
    } else if (isErc1155v1Collection(nftCollection)) {
      const resp = await sdk.nft.mint({
        collection: nftCollection,
        uri: "/ipfs/QmWLsBu6nS4ovaHbGAXprD1qEssJu4r5taQfB74sCG51tp",
        royalties: [],
        supply: 1,
      });
      tokenId = resp.tokenId;
    } else if (isErc721v1Collection(nftCollection)) {
      const resp = await sdk.nft.mint({
        collection: nftCollection,
        uri: "/ipfs/QmWLsBu6nS4ovaHbGAXprD1qEssJu4r5taQfB74sCG51tp",
        supply: 1,
      });
      tokenId = resp.tokenId;
    } else {
      tokenId = "";
      console.log("Wrong collection");
    }

    if (tokenId) {
      /**
       * Get minted nft through SDK
       */
      if (collection.isLazySupported && !collection.isLazy) {
        await retry(30, async () => {
          // wait when indexer aggregate an onChain nft
          await getTokenById(tokenId);
        });
      } else {
        await getTokenById(tokenId);
      }
    }
  };

  const getTokenById = async (tokenId) => {
    const token = await sdk.apis.nftItem.getNftItemById({
      itemId: `0x6ede7f3c26975aad32a475e1021d8f6f39c89d82:${tokenId}`,
    });
    if (token) {
      console.log("112", token.contract, token.tokenId);
      setCreateOrderForm({
        ...createOrderForm,
        contract: token.contract,
        tokenId: token.tokenId,
      });
    }
  };

  /**
   * Create sell order from minted nft
   */
  const createSellOrder = async () => {
    if (
      createOrderForm.contract &&
      createOrderForm.tokenId &&
      createOrderForm.price
    ) {
      const request = {
        makeAssetType: {
          assetClass: collection.type,
          contract: toAddress(createOrderForm.contract),
          tokenId: toBigNumber(createOrderForm.tokenId),
        },
        amount: 1,
        maker: toAddress(accounts[0]),
        originFees: [],
        payouts: [],
        price: createOrderForm.price,
        takeAssetType: { assetClass: "ETH" },
      };
      // Create an order
      const resultOrder = await sdk.order.sell(request);
      if (resultOrder) {
        setPurchaseOrderForm({ ...purchaseOrderForm, hash: resultOrder.hash });
      }
    }
  };

  /**
   * Create Bid
   */
  const handleCreateBid = async () => {
    console.log(createBidForm);
    // const contractErc20Address = createBidForm.contractErc20Address;
    const contractErc721Address = createBidForm.contractErc721Address;
    const tokenId = createBidForm.tokenId;
    const sellerAddress = createBidForm.sellerAddress;
    const buyerAddress = createBidForm.buyerAddress;
    const bidPrice = createBidForm.bidPrice;

    const request = {
      makeAssetType: {
        assetClass: "ETH",
        // contract: contractErc20Address,
      },
      maker: buyerAddress,
      takeAssetType: {
        assetClass: "ERC721",
        contract: contractErc721Address,
        tokenId: tokenId,
      },
      taker: sellerAddress,
      amount: 1,
      originFees: [],
      payouts: [],
      price: bidPrice,
    };
    const order = await sdk.order.bid(request);
    console.log("123", order);
  };

  /**
   * Buy order
   */
  const handlePurchaseOrder = async () => {
    const order = await sdk.apis.order.getOrderByHash({
      hash: purchaseOrderForm.hash,
    });
    switch (order.type) {
      case "RARIBLE_V1":
        await sdk.order.fill({
          order,
          amount: parseInt(purchaseOrderForm.amount),
          originFee: 0,
          originFees: [],
          infinite: true,
        });
        break;
      case "RARIBLE_V2":
        await sdk.order.fill({
          order,
          amount: parseInt(purchaseOrderForm.amount),
          originFees: [],
          infinite: true,
        });
        break;
      case "OPEN_SEA_V1":
        await sdk.order.fill({
          order,
          amount: parseInt(purchaseOrderForm.amount),
          originFees: [],
          infinite: true,
        });
        break;
      default:
        throw new Error(`Unsupported order : ${JSON.stringify(order)}`);
    }
  };

  /**
   * Fetch all bids for particular nft
   */
  const handleGetBidOrders = async () => {
    const { contract, tokenId } = fetchBidForm;
    if (contract && tokenId) {
      const items = await sdk.apis.order.getOrderBidsByItem({
        contract,
        tokenId,
      });
      setBidOrders(items ? items["orders"] : null);
    }
  };

  /**
   * Handle get NFT's owned by connected wallet
   */
  const handleGetMyNfts = async () => {
    const items = await sdk.apis.nftItem.getNftItemsByOwner({
      owner: accounts[0],
    });
    setOwnedItems(items?.items);
  };

  /**
   * debounce function for define collection type by collection id(contract address)
   */
  const searchType = debounce(async (collectionAddress) => {
    if (collectionAddress) {
      setCollection((prevState) => ({ ...prevState, loading: true }));
      const collectionResponse =
        await sdk.apis.nftCollection.getNftCollectionById({
          collection: collectionAddress,
        });
      setCollection((prevState) => ({
        ...prevState,
        type: collectionResponse.type,
        isLazySupported:
          collectionResponse.features.includes("MINT_AND_TRANSFER"), // check if it supports lazy minting
        loading: false,
      }));
    }
  }, 500);

  /**
   * input handlers
   */
  const handleChangeCollection = async (e) => {
    const value = e.currentTarget.value;
    setCollection((prevState) => ({ ...prevState, id: value }));
    if (value) {
      await searchType(value);
    }
  };
  const handleChangeLazy = () => {
    setCollection((prevState) => ({ ...prevState, isLazy: !prevState.isLazy }));
  };
  const handleChangeOrderContract = (e) => {
    setCreateOrderForm({ ...createOrderForm, contract: e.currentTarget.value });
  };
  const handleChangeOrderTokenId = (e) => {
    setCreateOrderForm({ ...createOrderForm, tokenId: e.currentTarget.value });
  };
  const handleChangeOrderPrice = (e) => {
    setCreateOrderForm({ ...createOrderForm, price: e.currentTarget.value });
  };
  const handleOrderHash = (e) => {
    setPurchaseOrderForm({ ...purchaseOrderForm, hash: e.currentTarget.value });
  };
  const handlePurchaseOrderAmount = (e) => {
    setPurchaseOrderForm({ ...createOrderForm, ...purchaseOrderForm, amount: e.currentTarget.value });
  };
  const handleBidOrderForm = (e, key) => {
    setCreateBidForm({ ...createBidForm, [key]: e.currentTarget.value });
  };
  const handleFetchBidsForm = (e, key) => {
    setFetchBidForm({ ...fetchBidForm, [key]: e.currentTarget.value });
  };

  console.log(collection, ownedItems, createOrderForm);
  return (
    <div className="App">
      <div>
        <button
          onClick={connectWalletHandler}
          disabled={!!provider?.selectedAddress}
        >
          {accounts.length ? "Connected" : "Connect wallet"}
        </button>
        {accounts.length && <span>Connected address: {accounts[0]}</span>}
        <hr />
        <div style={{ padding: "4px" }}>
          <p>Mint item form</p>
          <input
            onChange={handleChangeCollection}
            value={collection.id}
            placeholder="Collection (contract address)"
          />
          <p>collection type: {collection.loading ? "..." : collection.type}</p>
          {collection.isLazySupported && (
            <p>
              Lazy?&nbsp;
              <input
                type="checkbox"
                onChange={handleChangeLazy}
                checked={collection.isLazy}
              />
              &nbsp;&nbsp;
            </p>
          )}
          <button onClick={mint}>mint</button>
        </div>
        <hr />
      </div>

      <div style={{ padding: "4px" }}>
        <p>Create sell order form</p>
        <input
          onChange={handleChangeOrderContract}
          value={createOrderForm?.contract}
          placeholder={"Contract address"}
        />
        <input
          onChange={handleChangeOrderTokenId}
          value={createOrderForm?.tokenId}
          placeholder={"Token Id"}
        />
        <input
          onChange={handleChangeOrderPrice}
          value={createOrderForm?.price}
          placeholder={"Price"}
        />
        <button onClick={createSellOrder}>Sell</button>
      </div>
      <hr />
      <div style={{ padding: "4px" }}>
        <p>Create bid order form</p>
        {/* <input
          onChange={(e) => handleBidOrderForm(e,"contractErc20Address")}
          value={createBidForm?.contractErc20Address}
          placeholder={"Contract ERC20 address"}
        /> */}
        <input
          onChange={(e) => handleBidOrderForm(e, "contractErc721Address")}
          value={createBidForm?.contractErc721Address}
          placeholder={"contract ERC721 address"}
        />
        <input
          onChange={(e) => handleBidOrderForm(e, "tokenId")}
          value={createBidForm?.tokenId}
          placeholder={"tokenId"}
        />
        <input
          onChange={(e) => handleBidOrderForm(e, "sellerAddress")}
          value={createBidForm?.sellerAddress}
          placeholder={"sellerAddress"}
        />
        <input
          onChange={(e) => handleBidOrderForm(e, "buyerAddress")}
          value={createBidForm?.buyerAddress}
          placeholder={"buyerAddress"}
        />
        <input
          onChange={(e) => handleBidOrderForm(e, "bidPrice")}
          value={createBidForm?.bidPrice}
          placeholder={"bidPrice"}
        />
        <button onClick={handleCreateBid}>Create Bid</button>
      </div>
      <hr />
      <div style={{ padding: "4px" }}>
        <p>Purchase created order form</p>
        <input
          onChange={handleOrderHash}
          value={purchaseOrderForm.hash}
          placeholder={"Order hash"}
        />
        <input
          onChange={handlePurchaseOrderAmount}
          value={purchaseOrderForm.amount}
          placeholder={"amount"}
        />
        <button onClick={handlePurchaseOrder}>Purchase</button>
      </div>
      <hr />
      <div>
        <p>NFT items bids:</p>
        <input
          onChange={(e) => handleFetchBidsForm(e, "contract")}
          value={fetchBidForm.contract}
          placeholder={"Contract"}
        />
        <input
          onChange={(e) => handleFetchBidsForm(e, "tokenId")}
          value={fetchBidForm.tokenId}
          placeholder={"TokenId"}
        />
        <button onClick={handleGetBidOrders}>Fetch</button>
        <ul>
          {bidOrders?.length &&
            bidOrders.map((i) => {
              return (
                <li key={i.id}>
                  <p>
                    <strong>creator</strong> id:{" "}
                    {i.take.assetType.creators[0].account}
                  </p>
                  <p>
                    <strong>Bider:</strong> {i.maker}
                  </p>
                  <p>
                    <strong>Bid Amount:</strong> {i.makeStock}
                  </p>
                </li>
              );
            })}
        </ul>
      </div>
      <hr />
      <div>
        <p>
          NFT items owned by me:{" "}
          <button onClick={handleGetMyNfts}>Refresh</button>
        </p>
        <ul>
          {ownedItems?.length &&
            ownedItems.map((i) => {
              return (
                <li key={i.id}>
                  <p>
                    <strong>Item</strong> id: {i.id}
                  </p>
                  <p>
                    <strong>Lazy supply:</strong> {i.lazySupply}
                  </p>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
