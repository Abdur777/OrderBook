import express from "express";
import { OrderInputSchema } from "./types";
import { orderBook, bookWithQuantity } from "./orderbook";

const BASE_ASSET = "BTC";
const QUOTE_ASSET = "USD";

let GLOBAL_TRADE_ID = 0;

const app = express();
app.use(express.json());


app.post('/',(req,res)=>{
    const order = OrderInputSchema.safeParse(req.body);
    if(!order.success){
        res.status(400).send(order.error.message);
        return;
    }
    const {baseAsset,quoteAsset,price,quantity,side,type,kind} = order.data;
    console.log(order.data);
    const orderId = getOrderId();
    console.log(orderId);
    if(baseAsset !== BASE_ASSET || quoteAsset !== QUOTE_ASSET) {
        res.status(400).send('Invalid base or quote asset');
        return;
    }
    const {status, executedQty, fills } = fillOrder(orderId, price, quantity, side, kind);

    res.send({
        status,
        orderId,
        executedQty,
        fills
    });

})

function getOrderId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

interface Fill {
    "price": number,
    "qty": number,
    "tradeid": number
}

function fillOrder(orderId: string,price:number, quantity:number, side:"buy"|"sell",kind?:"ioc"):{ status:"accepted"|"rejected"; executedQty:number; fills:Fill[]}{
    const fills:Fill[] = [];
    const maxFillQuantity = getFillAmount(price,quantity,side);
    let executedQty = 0;
    console.log("maxFillQuantity",maxFillQuantity,"quantity",quantity)
    if(kind==='ioc' && maxFillQuantity<quantity){
        return {
            status: "rejected",
            executedQty: maxFillQuantity,
            fills: []
        }
    }
    // console.log(orderBook);
    // console.log(bookWithQuantity);
    if(side==="buy"){
        orderBook.asks.forEach(o => {
            if(o.price <= price && quantity>0){
                const filledQty = Math.min(quantity,o.quantity);
                o.quantity-=filledQty;
                bookWithQuantity.asks[o.price]=(bookWithQuantity.asks[o.price] || 0) - filledQty;
                fills.push({
                    price: o.price,
                    qty: filledQty,
                    tradeid: GLOBAL_TRADE_ID++
                })
                executedQty+=filledQty;
                quantity-=filledQty;
                if(o.quantity===0){
                    orderBook.asks.splice(orderBook.asks.indexOf(o), 1);
                }
                if(bookWithQuantity.asks[o.price]===0){
                    delete bookWithQuantity.asks[o.price];
                }
            }
        })
        if(quantity!==0){
            orderBook.bids.push({
                price,
                quantity,
                side:'bid',
                tradeId: orderId
            })
        }
        bookWithQuantity.bids[price] = (bookWithQuantity.bids[price] || 0) + quantity;
    }else {
        orderBook.bids.forEach(o=>{
            if(o.price>=price && quantity>0){
                const filledQty = Math.min(o.quantity,quantity);
                o.quantity-=filledQty;
                bookWithQuantity.asks[o.price]=(bookWithQuantity.asks[o.price] || 0)-filledQty;
                fills.push({
                    price: o.price,
                    qty: filledQty,
                    tradeid: GLOBAL_TRADE_ID++
                })
                executedQty+=filledQty;
                quantity-=filledQty;
            }
            if(o.quantity===0){
                orderBook.bids.splice(orderBook.bids.indexOf(o), 1);
            }
            if(bookWithQuantity.bids[o.price]===0){
                delete bookWithQuantity.bids[o.price];
            }
        })
        if(quantity!==0){
            orderBook.asks.push({
                price,
                quantity,
                side: 'ask',
                tradeId: orderId
            })
        }
        bookWithQuantity.asks[price] = (bookWithQuantity.asks[price] || 0) + (quantity);
    }
    console.log(orderBook);
    console.log(bookWithQuantity);
    return {
        status: "accepted",
        executedQty,
        fills
    }
}

function getFillAmount(price:number, quantity:number, side:"buy"|"sell"): number {
    let filled = 0;
    if(side==="buy"){
        orderBook.asks.forEach(o=>{
            if(o.price <=price){
                filled+=Math.min(o.quantity,quantity);
            }
        })
    }else{
        orderBook.bids.forEach(o=>{
            if(o.price >= price){
                filled+=Math.min(o.quantity,quantity);
            }
        })
    }
    console.log(filled)
    return filled;
}

app.listen(3000,()=> {
    console.log("Server running on port 3000")
})