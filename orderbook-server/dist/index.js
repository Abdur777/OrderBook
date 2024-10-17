"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const types_1 = require("./types");
const orderbook_1 = require("./orderbook");
const BASE_ASSET = "BTC";
const QUOTE_ASSET = "USD";
let GLOBAL_TRADE_ID = 0;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post('/', (req, res) => {
    const order = types_1.OrderInputSchema.safeParse(req.body);
    if (!order.success) {
        res.status(400).send(order.error.message);
        return;
    }
    const { baseAsset, quoteAsset, price, quantity, side, type, kind } = order.data;
    console.log(order.data);
    const orderId = getOrderId();
    console.log(orderId);
    if (baseAsset !== BASE_ASSET || quoteAsset !== QUOTE_ASSET) {
        res.status(400).send('Invalid base or quote asset');
        return;
    }
    const { status, executedQty, fills } = fillOrder(orderId, price, quantity, side, kind);
    res.send({
        status,
        orderId,
        executedQty,
        fills
    });
});
function getOrderId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
function fillOrder(orderId, price, quantity, side, kind) {
    const fills = [];
    const maxFillQuantity = getFillAmount(price, quantity, side);
    let executedQty = 0;
    console.log("maxFillQuantity", maxFillQuantity, "quantity", quantity);
    if (kind === 'ioc' && maxFillQuantity < quantity) {
        return {
            status: "rejected",
            executedQty: maxFillQuantity,
            fills: []
        };
    }
    // console.log(orderBook);
    // console.log(bookWithQuantity);
    if (side === "buy") {
        orderbook_1.orderBook.asks.forEach(o => {
            if (o.price <= price && quantity > 0) {
                const filledQty = Math.min(quantity, o.quantity);
                o.quantity -= filledQty;
                orderbook_1.bookWithQuantity.asks[o.price] = (orderbook_1.bookWithQuantity.asks[o.price] || 0) - filledQty;
                fills.push({
                    price: o.price,
                    qty: filledQty,
                    tradeid: GLOBAL_TRADE_ID++
                });
                executedQty += filledQty;
                quantity -= filledQty;
                if (o.quantity === 0) {
                    orderbook_1.orderBook.asks.splice(orderbook_1.orderBook.asks.indexOf(o), 1);
                }
                if (orderbook_1.bookWithQuantity.asks[o.price] === 0) {
                    delete orderbook_1.bookWithQuantity.asks[o.price];
                }
            }
        });
        if (quantity !== 0) {
            orderbook_1.orderBook.bids.push({
                price,
                quantity,
                side: 'bid',
                tradeId: orderId
            });
        }
        orderbook_1.bookWithQuantity.bids[price] = (orderbook_1.bookWithQuantity.bids[price] || 0) + quantity;
    }
    else {
        orderbook_1.orderBook.bids.forEach(o => {
            if (o.price >= price && quantity > 0) {
                const filledQty = Math.min(o.quantity, quantity);
                o.quantity -= filledQty;
                orderbook_1.bookWithQuantity.asks[o.price] = (orderbook_1.bookWithQuantity.asks[o.price] || 0) - filledQty;
                fills.push({
                    price: o.price,
                    qty: filledQty,
                    tradeid: GLOBAL_TRADE_ID++
                });
                executedQty += filledQty;
                quantity -= filledQty;
            }
            if (o.quantity === 0) {
                orderbook_1.orderBook.bids.splice(orderbook_1.orderBook.bids.indexOf(o), 1);
            }
            if (orderbook_1.bookWithQuantity.bids[o.price] === 0) {
                delete orderbook_1.bookWithQuantity.bids[o.price];
            }
        });
        if (quantity !== 0) {
            orderbook_1.orderBook.asks.push({
                price,
                quantity,
                side: 'ask',
                tradeId: orderId
            });
        }
        orderbook_1.bookWithQuantity.asks[price] = (orderbook_1.bookWithQuantity.asks[price] || 0) + (quantity);
    }
    console.log(orderbook_1.orderBook);
    console.log(orderbook_1.bookWithQuantity);
    return {
        status: "accepted",
        executedQty,
        fills
    };
}
function getFillAmount(price, quantity, side) {
    let filled = 0;
    if (side === "buy") {
        orderbook_1.orderBook.asks.forEach(o => {
            if (o.price <= price) {
                filled += Math.min(o.quantity, quantity);
            }
        });
    }
    else {
        orderbook_1.orderBook.bids.forEach(o => {
            if (o.price >= price) {
                filled += Math.min(o.quantity, quantity);
            }
        });
    }
    console.log(filled);
    return filled;
}
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
